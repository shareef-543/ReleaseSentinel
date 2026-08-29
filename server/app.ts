import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { CONSTANTS } from './config/constants.js';
import { requestLogger } from './middlewares/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route modules
import healthRouter from './routes/health.js';
import releasesRouter from './routes/releases.js';
import correctionsRouter from './routes/corrections.js';
import mlRouter from './routes/ml.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';

// ─────────────────────────────────────────
// App Bootstrap
// ─────────────────────────────────────────

const app = express();

// ── Global Middlewares ──
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Routes ──
const API = CONSTANTS.API_PREFIX; // /api/v1

app.use(`${API}/auth`,        authRouter);
app.use(`${API}/admin`,       adminRouter);
app.use(`${API}/health`,      healthRouter);
app.use(`${API}/releases`,    releasesRouter);
app.use(`${API}/corrections`, correctionsRouter);
app.use(`${API}/ml`,          mlRouter);
app.use(`${API}/ai`,          aiRouter);

// Legacy shims – keep old URL shape working for the frontend
app.use('/api/health',           healthRouter);
app.use('/api/releases',         releasesRouter);
app.use('/api/corrections',      correctionsRouter);
app.use('/api/ml/detect-problems', (req, res, next) => {
  // forward body in the shape the new route expects
  if (req.body?.content === undefined && req.body?.rawJson) {
    req.body.content = req.body.rawJson;
  }
  mlRouter(req, res, next);          // ← hits /detect internally via next hop
});
app.use('/api/ai/correct-manifest', (req, res, next) => {
  aiRouter(req, res, next);
});

// ── Developer API Portal (browser-friendly HTML) ──
app.get('/', (_req, res) => {
  const html = buildPortalHtml();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Production: Serve built React frontend ──
if (config.nodeEnv === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  // All non-API routes fallback to index.html for client-side routing
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// ── 404 & Global Error Handler (must be last) ──
app.use(notFoundHandler);
app.use(errorHandler);

// ─────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────

app.listen(config.port, () => {
  console.log('\n\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[36m║  ${CONSTANTS.APP_NAME}  v${CONSTANTS.VERSION}  ║\x1b[0m`);
  console.log('\x1b[36m╚══════════════════════════════════════════╝\x1b[0m');
  console.log(`\n  🌐  Portal  : \x1b[4mhttp://localhost:${config.port}\x1b[0m`);
  console.log(`  🔗  API     : \x1b[4mhttp://localhost:${config.port}${API}\x1b[0m`);
  console.log(`  🤖  Gemini  : ${config.geminiApiKey ? '\x1b[32m✓ Configured\x1b[0m (' + config.geminiModel + ')' : '\x1b[33m⚠ No API Key (fallback mode)\x1b[0m'}`);
  console.log(`  💾  DB      : server/data/db.json`);
  console.log(`  🔧  Env     : ${config.nodeEnv}\n`);
});

export default app;

// ─────────────────────────────────────────
// Developer Portal HTML Generator
// ─────────────────────────────────────────

function buildPortalHtml(): string {
  const endpoints = [
    { method: 'POST',   tag: 'blue',   path: `${API}/auth/login`,      desc: 'User & Admin login (email + password) → JWT token' },
    { method: 'POST',   tag: 'blue',   path: `${API}/auth/register`,   desc: 'Register new user account' },
    { method: 'GET',    tag: 'green',  path: `${API}/auth/me`,         desc: 'Get profile of authenticated user' },
    { method: 'GET',    tag: 'green',  path: `${API}/admin/stats`,     desc: '🛡️ Admin analytics overview & metrics' },
    { method: 'GET',    tag: 'green',  path: `${API}/admin/users`,     desc: '🛡️ List all registered users (admin only)' },
    { method: 'POST',   tag: 'blue',   path: `${API}/admin/users`,     desc: '🛡️ Create user account with assigned role' },
    { method: 'PATCH',  tag: 'orange', path: `${API}/admin/users/:id`, desc: '🛡️ Update user role, status (suspend/activate), password' },
    { method: 'DELETE', tag: 'red',    path: `${API}/admin/users/:id`, desc: '🛡️ Delete user account' },
    { method: 'GET',    tag: 'green',  path: `${API}/admin/audit-logs`,desc: '🛡️ System audit trail & activity stream' },
    { method: 'GET',    tag: 'green',  path: `${API}/admin/system-config`, desc: '🛡️ Get live system configuration' },
    { method: 'PATCH',  tag: 'orange', path: `${API}/admin/system-config`, desc: '🛡️ Update Gemini model & risk parameters' },
    { method: 'POST',   tag: 'red',    path: `${API}/admin/purge-data`,desc: '🛡️ Maintenance database purge' },
    { method: 'GET',    tag: 'green',  path: `${API}/health`,          desc: 'Server status, Gemini readiness & database stats' },
    { method: 'GET',    tag: 'green',  path: `${API}/releases`,        desc: 'List all stored releases  (?decision=GO|HOLD  &search=...)' },
    { method: 'GET',    tag: 'green',  path: `${API}/releases/:id`,    desc: 'Get one release by ID or release_id' },
    { method: 'POST',   tag: 'blue',   path: `${API}/releases`,        desc: 'Save a new release analysis record' },
    { method: 'PATCH',  tag: 'orange', path: `${API}/releases/:id`,    desc: 'Update notes or source on an existing release' },
    { method: 'DELETE', tag: 'red',    path: `${API}/releases/:id`,    desc: 'Permanently delete a release record' },
    { method: 'GET',    tag: 'green',  path: `${API}/corrections`,     desc: 'List all AI auto-healing correction logs' },
    { method: 'DELETE', tag: 'red',    path: `${API}/corrections/:id`, desc: 'Delete a correction log entry' },
    { method: 'POST',   tag: 'blue',   path: `${API}/ml/detect`,       desc: 'Run ML diagnostic scanner → { content, fileName? }' },
    { method: 'POST',   tag: 'blue',   path: `${API}/ai/heal`,         desc: 'Full ML + Gemini AI healing pipeline → { rawJson, autoSave? }' },
    { method: 'POST',   tag: 'blue',   path: `${API}/ai/correct-code`, desc: 'Universal multi-language source code correction' },
  ];

  const colors: Record<string, string> = {
    green: '#22c55e', blue: '#3b82f6', orange: '#f97316', red: '#ef4444',
  };

  const rows = endpoints
    .map(
      (e) => `
      <tr>
        <td><span class="badge" style="background:${colors[e.tag]}">${e.method}</span></td>
        <td><code>${e.path}</code></td>
        <td>${e.desc}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ReleaseSentinel API Portal</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:2rem}
    h1{font-size:1.75rem;font-weight:800;color:#fff;margin-bottom:.25rem}
    .subtitle{color:#94a3b8;font-size:.875rem;margin-bottom:2rem}
    .badge{display:inline-block;border-radius:4px;padding:2px 7px;color:#fff;font-size:.7rem;font-weight:700;min-width:52px;text-align:center}
    .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}
    .card h2{font-size:1rem;font-weight:700;color:#7dd3fc;margin-bottom:1rem}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    th{text-align:left;color:#64748b;font-weight:600;padding:.5rem .75rem;border-bottom:1px solid #334155}
    td{padding:.6rem .75rem;vertical-align:top;border-bottom:1px solid #1e293b}
    code{background:#0f172a;border:1px solid #334155;border-radius:4px;padding:2px 6px;font-size:.8rem;color:#38bdf8}
    .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem}
    .stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:1rem;text-align:center}
    .stat .val{font-size:1.5rem;font-weight:800;color:#38bdf8}
    .stat .lbl{font-size:.75rem;color:#64748b;margin-top:.2rem}
    footer{margin-top:2rem;text-align:center;color:#475569;font-size:.75rem}
  </style>
</head>
<body>
  <h1>🛡️ ReleaseSentinel</h1>
  <p class="subtitle">Developer Backend API Portal — v${CONSTANTS.VERSION}</p>

  <div class="stat-grid">
    <div class="stat"><div class="val" id="env">-</div><div class="lbl">Environment</div></div>
    <div class="stat"><div class="val" id="gemini">-</div><div class="lbl">Gemini AI</div></div>
    <div class="stat"><div class="val" id="releases">-</div><div class="lbl">Releases Stored</div></div>
    <div class="stat"><div class="val" id="corrections">-</div><div class="lbl">AI Corrections</div></div>
  </div>

  <div class="card">
    <h2>📡 API Endpoints  <code style="font-size:.7rem;color:#94a3b8">Base: ${API}</code></h2>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>📄 Quick Example — POST ${API}/ai/heal</h2>
    <pre style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:1rem;font-size:.78rem;overflow-x:auto;color:#7dd3fc"><code>fetch('http://localhost:${config.port}${API}/ai/heal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rawJson: '{ release_id: "REL-2026-099", changed_modules: ["payment-service",] }',
    autoSave: true
  })
})
.then(r => r.json())
.then(console.log);</code></pre>
  </div>

  <footer>ReleaseSentinel Developer Backend — Gemini AI • ML Engine • Express.js</footer>

  <script>
    fetch('/api/v1/health')
      .then(r=>r.json())
      .then(res=>{
        const d = res.data;
        document.getElementById('env').textContent = d.environment;
        document.getElementById('gemini').textContent = d.ai.gemini_configured ? '✓ Active' : '⚠ Fallback';
        document.getElementById('releases').textContent = d.database.releases_count;
        document.getElementById('corrections').textContent = d.database.corrections_count;
      }).catch(()=>{});
  </script>
</body>
</html>`;
}
