import type { ReleaseManifest } from '@/types';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MANIFEST_SCHEMA = `{
  "release_id": "string (e.g. REL-2026-042)",
  "changed_files": ["string[] (file paths)"],
  "changed_modules": ["string[] (module names ending in -service)"],
  "tests": { "passed": "number", "failed": "number", "flaky": "number" },
  "dependencies": ["string[] (library/package names)"],
  "test_coverage": "number (0-100, optional)"
}`;

const SYSTEM_PROMPT = `You are a JSON repair assistant for a software release manifest system.
The user will provide a malformed, incomplete, or incorrectly structured JSON document that is supposed to represent a release manifest.

The correct schema is:
${MANIFEST_SCHEMA}

Rules:
1. Fix any JSON syntax errors (missing quotes, trailing commas, unquoted keys, etc.)
2. If fields are missing, infer reasonable values from context or use sensible defaults:
   - release_id: generate one like "REL-2026-XXX" if missing
   - changed_files: extract file paths from the text if present, otherwise empty array
   - changed_modules: derive module names from file paths (e.g. "payment/processor.py" -> "payment-service"), or empty array
   - tests: if missing, default to {"passed": 0, "failed": 0, "flaky": 0}
   - dependencies: empty array if missing
   - test_coverage: 70 if missing
3. Ensure all field types are correct (numbers are numbers, arrays are arrays)
4. If the input is valid JSON but uses different field names, map them to the correct schema
5. Return ONLY the corrected JSON, no explanation, no markdown code fences

Respond with a single valid JSON object matching the schema.`;

export interface CorrectionResult {
  manifest: ReleaseManifest;
  corrections: string[];
  source: 'gemini' | 'fallback';
}

export function getGeminiApiKey(): string | null {
  return import.meta.env.VITE_GEMINI_API_KEY ?? null;
}

export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return !!key && key.length > 10;
}

export async function correctManifestWithAI(rawJson: string): Promise<CorrectionResult> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      return await correctWithGemini(rawJson, apiKey);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to deterministic correction:', err);
      return correctWithFallback(rawJson);
    }
  }

  return correctWithFallback(rawJson);
}

async function correctWithGemini(rawJson: string, apiKey: string): Promise<CorrectionResult> {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `Please fix this JSON manifest:\n\n${rawJson}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned no content');
  }

  const cleaned = stripCodeFences(text);
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini returned a JSON value instead of a manifest object');
  }
  const validated = validateAndNormalize(parsed as Partial<ReleaseManifest>);
  const corrections = describeCorrections(rawJson, JSON.stringify(validated, null, 2));

  return { manifest: validated, corrections, source: 'gemini' };
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

function correctWithFallback(rawJson: string): Promise<CorrectionResult> {
  const corrections: string[] = [];
  let parsed: Record<string, unknown> | null = null;

  // Attempt 1: direct parse
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    // Attempt 2: fix common JSON issues
    const fixed = fixCommonJsonErrors(rawJson, corrections);
    try {
      parsed = JSON.parse(fixed);
    } catch {
      // Attempt 3: extract JSON object from surrounding text
      const extracted = extractJsonObject(rawJson);
      if (extracted) {
        const fixed2 = fixCommonJsonErrors(extracted, corrections);
        try {
          parsed = JSON.parse(fixed2);
        } catch {
          // Attempt 4: try to salvage key-value pairs
          parsed = salvageKeyValue(rawJson, corrections);
        }
      }
    }
  }

  if (!parsed) {
    return Promise.reject(new Error('Could not parse or repair the JSON. Please check the format or provide a Gemini API key for AI-assisted correction.'));
  }

  const manifest = validateAndNormalize(parsed);
  const moreCorrections = describeCorrections(rawJson, JSON.stringify(manifest, null, 2));
  return Promise.resolve({
    manifest,
    corrections: [...corrections, ...moreCorrections],
    source: 'fallback',
  });
}

function fixCommonJsonErrors(json: string, corrections: string[]): string {
  let fixed = json;

  // Remove trailing commas before } or ]
  if (/,\s*[}\]]/.test(fixed)) {
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    corrections.push('Removed trailing commas');
  }

  // Quote unquoted keys
  if (/[{,]\s*[a-zA-Z_]\w*\s*:/.test(fixed)) {
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_]\w*)(\s*:)/g, '$1"$2"$3');
    corrections.push('Quoted unquoted JSON keys');
  }

  // Fix single quotes to double quotes (careful not to break apostrophes in values)
  if (/'[^']*'\s*:/.test(fixed) || /:\s*'[^']*'/.test(fixed)) {
    fixed = fixed.replace(/'([^']*)'(\s*:)/g, '"$1"$2');
    fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');
    corrections.push('Converted single quotes to double quotes');
  }

  return fixed;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return null;
}

function salvageKeyValue(text: string, corrections: string[]): Record<string, unknown> {
  corrections.push('Salvaged key-value pairs from malformed input');
  const result: Record<string, unknown> = {};

  // Try to find release_id
  const idMatch = text.match(/release_?id["\s:]*["']?([A-Za-z0-9_-]+)["']?/i);
  if (idMatch) result.release_id = idMatch[1];

  // Try to find arrays
  const filesMatch = text.match(/changed_?files["\s:]*\[([^\]]*)\]/i);
  if (filesMatch) {
    result.changed_files = filesMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
  }

  const modulesMatch = text.match(/changed_?modules["\s:]*\[([^\]]*)\]/i);
  if (modulesMatch) {
    result.changed_modules = modulesMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
  }

  const depsMatch = text.match(/dependencies["\s:]*\[([^\]]*)\]/i);
  if (depsMatch) {
    result.dependencies = depsMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
  }

  // Tests
  const passedMatch = text.match(/passed["\s:]*(\d+)/i);
  const failedMatch = text.match(/failed["\s:]*(\d+)/i);
  const flakyMatch = text.match(/flaky["\s:]*(\d+)/i);
  result.tests = {
    passed: passedMatch ? parseInt(passedMatch[1]) : 0,
    failed: failedMatch ? parseInt(failedMatch[1]) : 0,
    flaky: flakyMatch ? parseInt(flakyMatch[1]) : 0,
  };

  const coverageMatch = text.match(/coverage["\s:]*(\d+)/i);
  if (coverageMatch) result.test_coverage = parseInt(coverageMatch[1]);

  return result;
}

function validateAndNormalize(raw: Partial<ReleaseManifest>): ReleaseManifest {
  const corrections: string[] = [];

  const manifest: ReleaseManifest = {
    release_id: raw.release_id || 'REL-2026-XXX',
    changed_files: Array.isArray(raw.changed_files) ? raw.changed_files.filter((f) => typeof f === 'string') : [],
    changed_modules: Array.isArray(raw.changed_modules) ? raw.changed_modules.filter((m) => typeof m === 'string') : [],
    tests: {
      passed: typeof raw.tests?.passed === 'number' ? raw.tests.passed : 0,
      failed: typeof raw.tests?.failed === 'number' ? raw.tests.failed : 0,
      flaky: typeof raw.tests?.flaky === 'number' ? raw.tests.flaky : 0,
    },
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.filter((d) => typeof d === 'string') : [],
    test_coverage: typeof raw.test_coverage === 'number' ? raw.test_coverage : 70,
  };

  if (!raw.release_id) corrections.push('Generated missing release_id');
  if (!Array.isArray(raw.changed_files)) corrections.push('Initialized missing changed_files array');
  if (!Array.isArray(raw.changed_modules)) corrections.push('Initialized missing changed_modules array');
  if (!raw.tests) corrections.push('Created missing tests object with defaults');
  if (!Array.isArray(raw.dependencies)) corrections.push('Initialized missing dependencies array');
  if (typeof raw.test_coverage !== 'number') corrections.push('Set default test_coverage to 70%');

  return manifest;
}

function describeCorrections(original: string, corrected: string): string[] {
  const corrections: string[] = [];
  let orig: Record<string, unknown> | null = null;
  let corr: Record<string, unknown> | null = null;

  try { orig = JSON.parse(original); } catch { /* */ }
  try { corr = JSON.parse(corrected); } catch { /* */ }

  if (!orig) {
    corrections.push('Fixed JSON syntax to produce a valid manifest');
    return corrections;
  }

  if (corr) {
    if (!orig.release_id && corr.release_id) corrections.push('Added missing release_id');
    if (!Array.isArray(orig.changed_files) && Array.isArray(corr.changed_files)) corrections.push('Added missing changed_files array');
    if (!Array.isArray(orig.changed_modules) && Array.isArray(corr.changed_modules)) corrections.push('Added missing changed_modules array');
    if (!orig.tests && corr.tests) corrections.push('Added missing tests object');
    if (!Array.isArray(orig.dependencies) && Array.isArray(corr.dependencies)) corrections.push('Added missing dependencies array');
    if (typeof orig.test_coverage !== 'number' && typeof corr.test_coverage === 'number') corrections.push('Added default test_coverage');
  }

  if (corrections.length === 0) corrections.push('JSON structure validated and normalized');

  return corrections;
}
