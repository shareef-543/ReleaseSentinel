import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { analyzeFileWithML } from '../src/ml/fileProblemDetector.js';
import { analyzeRelease, simulateRollout, reassess } from '../src/agent/releaseAgent.js';
import { readDatabase, writeDatabase } from './storage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── 1. System Health & Metadata ────────────────────────────────
app.get('/api/health', (req: Request, res: Response) => {
  const db = readDatabase();
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  res.json({
    status: 'healthy',
    service: 'ReleaseSentinel Developer Backend',
    version: '2.0.0',
    port: PORT,
    timestamp: new Date().toISOString(),
    ai_status: {
      gemini_configured: !!apiKey && apiKey.length > 10,
      model: GEMINI_MODEL,
    },
    database: {
      records_count: db.releases.length,
      corrections_count: db.corrections.length,
      storage_type: 'File-backed persistent JSON database',
    },
    endpoints: [
      { method: 'POST', path: '/api/ml/detect-problems', desc: 'ML Problem Detection & Anomaly Scanner' },
      { method: 'POST', path: '/api/ai/correct-manifest', desc: 'Gemini AI Auto-Healing Engine' },
      { method: 'POST', path: '/api/releases/analyze', desc: 'Autonomous Release Risk Intelligence Engine' },
      { method: 'POST', path: '/api/releases/simulate', desc: 'Rollout Telemetry Simulation & Reassessment' },
      { method: 'GET', path: '/api/releases', desc: 'Fetch stored releases' },
      { method: 'POST', path: '/api/releases', desc: 'Save release analysis' },
      { method: 'DELETE', path: '/api/releases/:id', desc: 'Delete release analysis' },
      { method: 'GET', path: '/api/corrections', desc: 'Fetch AI auto-healing logs' },
    ],
  });
});

// ── 2. ML Problem Detection Endpoint ──────────────────────────
app.post('/api/ml/detect-problems', (req: Request, res: Response) => {
  const { content, fileName } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "content" string in request body.' });
  }

  try {
    const result = analyzeFileWithML(content, fileName || 'manifest.json');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'ML analysis failed', details: err.message });
  }
});

// ── 3. AI Manifest Auto-Healing Endpoint ───────────────────────
app.post('/api/ai/correct-manifest', async (req: Request, res: Response) => {
  const { rawJson, apiKey: reqKey, detectedProblems } = req.body;

  if (!rawJson || typeof rawJson !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "rawJson" string in request body.' });
  }

  const apiKey = reqKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: 'No Gemini API key provided. Pass apiKey in request body or set GEMINI_API_KEY in server environment.',
    });
  }

  try {
    const problemsContext = detectedProblems && detectedProblems.length > 0
      ? `\n\nIdentified Problems to Fix:\n${detectedProblems.map((p: any) => `- [${p.severity.toUpperCase()}] ${p.title}: ${p.details} (Suggested Fix: ${p.suggestedFix})`).join('\n')}`
      : '';

    const systemPrompt = `You are ReleaseSentinel's AI Auto-Healing Engine for software release manifests.
Target Schema:
{
  "release_id": "string (e.g. REL-2026-042)",
  "changed_files": ["string[]"],
  "changed_modules": ["string[]"],
  "tests": { "passed": number, "failed": number, "flaky": number },
  "dependencies": ["string[]"],
  "test_coverage": number (0-100)
}
Return ONLY valid JSON matching the schema with no markdown code fences.`;

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Repair and normalize this release manifest:\n\n${rawJson}${problemsContext}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: `Gemini API error (${geminiRes.status})`, details: errText });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const manifest = JSON.parse(cleaned);

    // Save correction record in backend
    const db = readDatabase();
    const corrRecord = {
      id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      release_id: manifest.release_id || 'REL-2026-UNKNOWN',
      created_at: new Date().toISOString(),
      original_snippet: rawJson.slice(0, 1000),
      corrected_manifest: manifest,
      problems_found: Array.isArray(detectedProblems) ? detectedProblems.length : 0,
      corrections_count: 1,
      source: 'gemini',
    };
    db.corrections = [corrRecord, ...db.corrections].slice(0, 100);
    writeDatabase(db);

    res.json({
      manifest,
      source: 'gemini',
      record_id: corrRecord.id,
      timestamp: corrRecord.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'AI correction failed', details: err.message });
  }
});

// ── 4. Autonomous Release Risk Intelligence Analysis ───────────
app.post('/api/releases/analyze', (req: Request, res: Response) => {
  const { manifest } = req.body;

  if (!manifest || typeof manifest !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid "manifest" object in request body.' });
  }

  try {
    const analysis = analyzeRelease(manifest);

    // Auto save if requested
    if (req.body.autoSave) {
      const db = readDatabase();
      const record = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        release_id: manifest.release_id,
        created_at: new Date().toISOString(),
        overall_risk: analysis.overall_risk,
        decision: analysis.decision,
        manifest,
        analysis,
        source: 'api',
      };
      db.releases = [record, ...db.releases].slice(0, 200);
      writeDatabase(db);
    }

    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

// ── 5. Rollout Telemetry Simulation & Reassessment ─────────────
app.post('/api/releases/simulate', (req: Request, res: Response) => {
  const { manifest, analysis, percentage } = req.body;

  if (!manifest || !analysis || typeof percentage !== 'number') {
    return res.status(400).json({ error: 'Missing manifest, analysis, or percentage parameters.' });
  }

  try {
    const simulation = simulateRollout(manifest, analysis, percentage);
    const reassessmentResult = reassess(analysis, simulation);

    res.json({
      simulation,
      reassessment: reassessmentResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Simulation failed', details: err.message });
  }
});

// ── 6. Releases CRUD Endpoints ─────────────────────────────────
app.get('/api/releases', (req: Request, res: Response) => {
  const db = readDatabase();
  const { decision, search } = req.query;

  let results = db.releases;

  if (decision && typeof decision === 'string') {
    results = results.filter((r) => r.decision === decision);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(
      (r) =>
        r.release_id.toLowerCase().includes(q) ||
        (r.manifest?.changed_modules && r.manifest.changed_modules.some((m: string) => m.toLowerCase().includes(q))),
    );
  }

  res.json({
    total: results.length,
    releases: results,
  });
});

app.post('/api/releases', (req: Request, res: Response) => {
  const { manifest, analysis, simulation, reassessment, notes, source } = req.body;

  if (!manifest || !analysis) {
    return res.status(400).json({ error: 'Manifest and Analysis objects are required.' });
  }

  const db = readDatabase();
  const record = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    release_id: manifest.release_id,
    created_at: new Date().toISOString(),
    overall_risk: analysis.overall_risk,
    decision: analysis.decision,
    manifest,
    analysis,
    simulation: simulation || null,
    reassessment: reassessment || null,
    notes: notes || null,
    source: source || 'developer_api',
  };

  db.releases = [record, ...db.releases].slice(0, 200);
  writeDatabase(db);

  res.status(201).json(record);
});

app.get('/api/releases/:id', (req: Request, res: Response) => {
  const db = readDatabase();
  const record = db.releases.find((r) => r.id === req.params.id || r.release_id === req.params.id);

  if (!record) {
    return res.status(404).json({ error: 'Release record not found.' });
  }

  res.json(record);
});

app.delete('/api/releases/:id', (req: Request, res: Response) => {
  const db = readDatabase();
  const initialLength = db.releases.length;
  db.releases = db.releases.filter((r) => r.id !== req.params.id && r.release_id !== req.params.id);

  if (db.releases.length === initialLength) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  writeDatabase(db);
  res.json({ success: true, message: 'Record deleted successfully.' });
});

// ── 7. Corrections CRUD Endpoints ──────────────────────────────
app.get('/api/corrections', (req: Request, res: Response) => {
  const db = readDatabase();
  res.json({
    total: db.corrections.length,
    corrections: db.corrections,
  });
});

// ── 8. Built-in Interactive Developer Portal ───────────────────
app.get('/', (req: Request, res: Response) => {
  const db = readDatabase();
  const apiKeyConfigured = !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ReleaseSentinel • Developer API Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #020617; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; }
  </style>
</head>
<body class="p-8 max-w-6xl mx-auto space-y-8">
  <div class="border-b border-slate-800 pb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white flex items-center gap-2">
        <span class="text-cyan-400">⚡</span> ReleaseSentinel Developer Backend API
      </h1>
      <p class="text-sm text-slate-400 mt-1">Autonomous Release Risk & AI Auto-Healing RESTful Service</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="px-3 py-1 rounded-full text-xs font-mono border ${apiKeyConfigured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}">
        Gemini AI: ${apiKeyConfigured ? 'Configured ✓' : 'Add Key in .env'}
      </span>
      <span class="px-3 py-1 rounded-full text-xs font-mono border border-blue-500/30 bg-blue-500/10 text-blue-300">
        Port: ${PORT}
      </span>
    </div>
  </div>

  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div class="text-xs text-slate-400">Stored Release Runs</div>
      <div class="text-2xl font-bold text-white font-mono mt-1">${db.releases.length}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div class="text-xs text-slate-400">AI Manifest Corrections</div>
      <div class="text-2xl font-bold text-purple-400 font-mono mt-1">${db.corrections.length}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div class="text-xs text-slate-400">Server Health</div>
      <div class="text-2xl font-bold text-emerald-400 font-mono mt-1">ONLINE 200 OK</div>
    </div>
  </div>

  <!-- API Endpoints Interactive Table -->
  <div class="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
    <div class="p-4 border-b border-slate-800 font-semibold text-sm text-slate-300">Developer REST API Endpoints</div>
    <div class="divide-y divide-slate-800 text-xs font-mono">
      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">GET</span>
          <span class="text-slate-200">/api/health</span>
        </div>
        <a href="/api/health" target="_blank" class="text-cyan-400 hover:underline">Execute ↗</a>
      </div>

      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">GET</span>
          <span class="text-slate-200">/api/releases</span>
        </div>
        <a href="/api/releases" target="_blank" class="text-cyan-400 hover:underline">Execute ↗</a>
      </div>

      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">GET</span>
          <span class="text-slate-200">/api/corrections</span>
        </div>
        <a href="/api/corrections" target="_blank" class="text-cyan-400 hover:underline">Execute ↗</a>
      </div>

      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">POST</span>
          <span class="text-slate-200">/api/ml/detect-problems</span>
          <span class="text-[11px] text-slate-500 font-sans">(Body: { "content": "..." })</span>
        </div>
        <span class="text-slate-500">POST endpoint</span>
      </div>

      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">POST</span>
          <span class="text-slate-200">/api/ai/correct-manifest</span>
          <span class="text-[11px] text-slate-500 font-sans">(Body: { "rawJson": "...", "apiKey": "..." })</span>
        </div>
        <span class="text-slate-500">POST endpoint</span>
      </div>

      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">POST</span>
          <span class="text-slate-200">/api/releases/analyze</span>
          <span class="text-[11px] text-slate-500 font-sans">(Body: { "manifest": { ... } })</span>
        </div>
        <span class="text-slate-500">POST endpoint</span>
      </div>

      <div class="p-4 flex items-center justify-between hover:bg-slate-800/40">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold">POST</span>
          <span class="text-slate-200">/api/releases/simulate</span>
          <span class="text-[11px] text-slate-500 font-sans">(Body: { "manifest": { ... }, "analysis": { ... }, "percentage": 50 })</span>
        </div>
        <span class="text-slate-500">POST endpoint</span>
      </div>
    </div>
  </div>

  <div class="text-xs text-slate-500 text-center">
    ReleaseSentinel Server • Connected to Web Frontend on http://localhost:5174
  </div>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 ReleaseSentinel Developer Backend Running!`);
  console.log(`  🔗 Server URL: http://localhost:${PORT}`);
  console.log(`  📖 Developer Portal: http://localhost:${PORT}/`);
  console.log(`  🩺 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});
