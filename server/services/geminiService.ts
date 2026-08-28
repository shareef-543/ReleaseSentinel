import { config } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import { correctWithFallback } from '../../src/lib/gemini.js';
import type { ReleaseManifest, FileProblem } from '../../src/types/index.js';

export interface AiCorrectionResult {
  manifest: ReleaseManifest;
  source: 'gemini' | 'fallback';
  model?: string;
  explanation: string;
}

class GeminiService {
  public async correctManifest(
    rawJson: string,
    detectedProblems?: FileProblem[],
    userApiKey?: string,
  ): Promise<AiCorrectionResult> {
    const apiKey = userApiKey || config.geminiApiKey;

    if (apiKey && apiKey.length > 10) {
      try {
        return await this.callGeminiApi(rawJson, apiKey, detectedProblems);
      } catch (err: any) {
        console.warn('Gemini API call failed, using deterministic fallback healing:', err.message);
        const fallback = await correctWithFallback(rawJson, detectedProblems);
        return {
          manifest: fallback.manifest,
          source: 'fallback',
          explanation: fallback.explanation,
        };
      }
    }

    const fallback = await correctWithFallback(rawJson, detectedProblems);
    return {
      manifest: fallback.manifest,
      source: 'fallback',
      explanation: fallback.explanation,
    };
  }

  private async callGeminiApi(
    rawJson: string,
    apiKey: string,
    detectedProblems?: FileProblem[],
  ): Promise<AiCorrectionResult> {
    const problemsContext =
      detectedProblems && detectedProblems.length > 0
        ? `\n\nIdentified Problems to Fix:\n${detectedProblems
            .map(
              (p) =>
                `- [${p.severity.toUpperCase()}] ${p.title}: ${p.details} (Suggested Fix: ${p.suggestedFix})`,
            )
            .join('\n')}`
        : '';

    const systemPrompt = `You are ReleaseSentinel's AI Auto-Healing Engine for software release manifests.
Target Schema:
{
  "release_id": "string (e.g. REL-2026-042)",
  "changed_files": ["string[]"],
  "changed_modules": ["string[] ending in -service"],
  "tests": { "passed": number, "failed": number, "flaky": number },
  "dependencies": ["string[]"],
  "test_coverage": number (0-100)
}
Instructions:
1. Fix all JSON syntax errors (unquoted keys, trailing commas, single quotes).
2. Infer reasonable defaults for missing fields.
3. Return ONLY a single valid JSON object matching the schema with no markdown code fences.`;

    const endpoint = `${CONSTANTS.GEMINI_BASE_URL}/${config.geminiModel}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Repair and normalize this release manifest input:\n\n${rawJson}${problemsContext}` }],
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
      throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response content from Gemini');

    const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const manifest: ReleaseManifest = JSON.parse(cleaned);

    return {
      manifest,
      source: 'gemini',
      model: config.geminiModel,
      explanation: `Gemini AI (${config.geminiModel}) successfully repaired syntax, resolved schema conflicts, and normalized data structures.`,
    };
  }
}

export const geminiService = new GeminiService();
