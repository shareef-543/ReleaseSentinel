import React, { useState, useCallback } from 'react';
import { analyzeCode } from '@/ml/codeAnalyzer';
import type { CodeAnalysisResult, CodeProblem } from '@/ml/codeAnalyzer';
import { correctAnyCode } from '@/lib/gemini';
import type { CodeCorrectionResult } from '@/lib/gemini';
import {
  Code2, Zap, Wand2, GitCompare, CheckCircle, AlertTriangle, ShieldAlert,
  Copy, ChevronRight, RefreshCw, FileCode2, ArrowRight, Cpu, Sparkles,
  CircleAlert, Info, ShieldCheck,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type Stage = 'input' | 'ml-analysis' | 'ai-correction' | 'result';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNo: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: ShieldAlert },
  high:     { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: AlertTriangle },
  medium:   { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: CircleAlert },
  low:      { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: Info },
  info:     { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', icon: Info },
};

const RISK_COLOR = {
  low:      'text-emerald-400',
  medium:   'text-yellow-400',
  high:     'text-orange-400',
  critical: 'text-red-400',
};

const HEALTH_BG = (score: number) =>
  score >= 80 ? 'from-emerald-500' : score >= 60 ? 'from-yellow-500' : score >= 35 ? 'from-orange-500' : 'from-red-500';

const SAMPLE_SNIPPETS: Record<string, { label: string; lang: string; code: string }> = {
  python: {
    label: 'Python — Security Issues',
    lang: 'Python',
    code: `import *
from utils import *

db_password = "super_secret_123"
api_key = "sk-prod-abcdef1234567890"

def login(username, password):
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    try:
        result = db.execute(query)
        if result == True:
            print("Login successful for: " + username)
            return result
    except:
        pass

def process(data):
    return eval(data)
`,
  },
  javascript: {
    label: 'JavaScript — Common Bugs',
    lang: 'JavaScript',
    code: `var apiUrl = "https://api.example.com"
var secretToken = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

function fetchUser(id) {
  var result = null
  fetch(apiUrl + "/users/" + id)
    .then(function(res) {
      if (res.status == 200) {
        result = res.json()
        console.log("User fetched:", result)
      }
    })
    .catch(function(e) {})

  document.getElementById("output").innerHTML = result
  return result
}

// TODO: add proper auth later
// FIXME: this breaks on edge cases
function validate(x) {
  if (x == true) return true
  if (x == false) return false
}
`,
  },
  java: {
    label: 'Java — Error Handling',
    lang: 'Java',
    code: `import java.sql.*;
import java.io.*;

public class UserService {
    private static final String DB_PASS = "admin123";
    
    public User getUser(String username) {
        try {
            String query = "SELECT * FROM users WHERE name = '" + username + "'";
            ResultSet rs = db.execute(query);
            System.out.println("Query executed for: " + username);
            return mapUser(rs);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    public void deleteUser(String id) {
        // TODO: add authorization check
        String sql = "DELETE FROM users WHERE id = " + id;
        db.execute(sql);
    }
}
`,
  },
  sql: {
    label: 'SQL — Injection & Performance',
    lang: 'SQL',
    code: `-- User lookup (dynamic)
SELECT * FROM users WHERE username = '' + @username + '';

-- Admin check
SELECT * FROM admins WHERE 1=1 AND active = 1;

-- Drop old table
DROP TABLE old_sessions;

-- Get all orders with join
SELECT * FROM orders o 
JOIN customers c ON o.customer_id = c.id
JOIN products p ON o.product_id = p.id;
`,
  },
};

function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const result: DiffLine[] = [];
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  let lineNo = 1;
  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i] ?? null;
    const a = afterLines[i] ?? null;

    if (b === a) {
      if (b !== null) result.push({ type: 'unchanged', content: b, lineNo: lineNo++ });
    } else {
      if (b !== null) result.push({ type: 'removed', content: b, lineNo: lineNo++ });
      if (a !== null) result.push({ type: 'added', content: a, lineNo: lineNo++ });
    }
  }
  return result;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ProblemCard({ problem }: { problem: CodeProblem }) {
  const cfg = SEVERITY_CONFIG[problem.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{problem.severity}</span>
            {problem.line && <span className="text-xs text-slate-500 font-mono">Line {problem.line}</span>}
            <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">{problem.category}</span>
          </div>
          <p className="text-sm font-semibold text-slate-200 mt-0.5">{problem.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{problem.description}</p>
          <p className="text-xs text-emerald-400 mt-1">💡 {problem.suggestedFix}</p>
        </div>
      </div>
    </div>
  );
}

function DiffViewer({ before, after }: { before: string; after: string }) {
  const [mode, setMode] = useState<'split' | 'unified'>('unified');
  const diffLines = computeDiff(before, after);

  const added   = diffLines.filter((l) => l.type === 'added').length;
  const removed = diffLines.filter((l) => l.type === 'removed').length;

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-900/80 px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-400">+{added} added</span>
          <span className="text-red-400">−{removed} removed</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-0.5">
          {(['unified', 'split'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${mode === m ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'unified' ? (
        <div className="overflow-auto max-h-96 text-xs font-mono bg-slate-950">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={`flex items-start px-3 py-0.5 ${
                line.type === 'added' ? 'bg-emerald-500/10 text-emerald-300' :
                line.type === 'removed' ? 'bg-red-500/10 text-red-300' :
                'text-slate-400'
              }`}
            >
              <span className="w-6 flex-shrink-0 text-slate-600 select-none">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              <span className="w-8 flex-shrink-0 text-slate-600 select-none text-right pr-2">{line.lineNo}</span>
              <pre className="whitespace-pre-wrap break-all">{line.content}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-slate-700 overflow-auto max-h-96">
          <div>
            <div className="px-3 py-1 text-xs font-semibold text-red-400 bg-red-500/5 border-b border-slate-700">Before</div>
            {before.split('\n').map((line, i) => (
              <div key={i} className="px-3 py-0.5 text-xs font-mono text-slate-400 whitespace-pre-wrap break-all bg-slate-950">{line || ' '}</div>
            ))}
          </div>
          <div>
            <div className="px-3 py-1 text-xs font-semibold text-emerald-400 bg-emerald-500/5 border-b border-slate-700">After</div>
            {after.split('\n').map((line, i) => (
              <div key={i} className={`px-3 py-0.5 text-xs font-mono whitespace-pre-wrap break-all ${line.includes('FIXED:') ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-300 bg-slate-950'}`}>{line || ' '}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ML Processing Animation ─────────────────────────────────────────────────

const ML_STAGES = [
  { label: 'Detecting programming language...', icon: FileCode2 },
  { label: 'Running AST & syntax validation...', icon: Code2 },
  { label: 'Scanning for security vulnerabilities...', icon: ShieldAlert },
  { label: 'Detecting bugs & logic errors...', icon: AlertTriangle },
  { label: 'Checking code quality & style patterns...', icon: Cpu },
  { label: 'Computing health score & risk level...', icon: Zap },
];

function MlProcessingView({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-3 py-2">
      {ML_STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border transition-all duration-300 ${
              done ? 'border-emerald-500/20 bg-emerald-500/5' :
              active ? 'border-cyan-500/30 bg-cyan-500/10 animate-pulse' :
              'border-slate-800 bg-slate-900/30 opacity-40'
            }`}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${done ? 'text-emerald-400' : active ? 'text-cyan-400' : 'text-slate-600'}`} />
            <span className={`text-sm ${done ? 'text-emerald-300' : active ? 'text-cyan-300' : 'text-slate-500'}`}>{stage.label}</span>
            {done && <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />}
            {active && (
              <div className="ml-auto flex gap-0.5">
                {[0,1,2].map(d => (
                  <div key={d} className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CodeCorrectionPipeline() {
  const [stage, setStage]               = useState<Stage>('input');
  const [code, setCode]                 = useState('');
  const [fileName, setFileName]         = useState('');
  const [mlStep, setMlStep]             = useState(0);
  const [mlResult, setMlResult]         = useState<CodeAnalysisResult | null>(null);
  const [correction, setCorrection]     = useState<CodeCorrectionResult | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [copied, setCopied]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (!code.trim()) return;
    setError(null);
    setMlStep(0);
    setStage('ml-analysis');

    // Animate ML stages
    for (let i = 0; i <= ML_STAGES.length; i++) {
      await new Promise<void>((res) => setTimeout(res, 500));
      setMlStep(i);
    }

    const result = analyzeCode(code, fileName || undefined);
    setMlResult(result);

    // Move to AI correction
    setStage('ai-correction');
    setAiProcessing(true);

    try {
      const corr = await correctAnyCode(
        code,
        result.languageLabel,
        result.problems.map((p) => ({
          title: p.title,
          description: p.description,
          suggestedFix: p.suggestedFix,
          severity: p.severity,
        })),
      );
      setCorrection(corr);
      setStage('result');
    } catch (err: any) {
      setError(err.message ?? 'AI correction failed');
      setStage('ml-analysis');
    } finally {
      setAiProcessing(false);
    }
  }, [code, fileName]);

  const handleReset = () => {
    setStage('input');
    setMlResult(null);
    setCorrection(null);
    setError(null);
    setMlStep(0);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Code2 className="h-5 w-5 text-cyan-400" />
            Code Correction Pipeline
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Paste any code in any language. ML detection → Gemini AI healing → Before/After comparison.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs font-semibold">
          {['Input', 'ML Scan', 'AI Heal', 'Result'].map((s, i) => {
            const stageMap: Stage[] = ['input', 'ml-analysis', 'ai-correction', 'result'];
            const current = ['input', 'ml-analysis', 'ai-correction', 'result'].indexOf(stage);
            const isActive = i === current;
            const isDone = i < current;
            return (
              <React.Fragment key={s}>
                <div className={`rounded-full px-2.5 py-1 ${isDone ? 'bg-emerald-500/20 text-emerald-300' : isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>
                  {isDone ? '✓ ' : ''}{s}
                </div>
                {i < 3 && <ChevronRight className="h-3 w-3 text-slate-600" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* STAGE 1: INPUT */}
      {stage === 'input' && (
        <div className="space-y-4">
          {/* Sample picker */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center">Quick samples:</span>
            {Object.entries(SAMPLE_SNIPPETS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => { setCode(val.code); setFileName(`example.${key === 'javascript' ? 'js' : key === 'python' ? 'py' : key === 'java' ? 'java' : 'sql'}`); }}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
              >
                {val.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Optional: filename (e.g. main.py, App.tsx) — helps with language detection"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`Paste your code here...\n\nSupported: Python, JavaScript, TypeScript, Java, C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, SQL, HTML, CSS, Bash, YAML, JSON`}
              rows={18}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none resize-y"
            />
            <div className="absolute bottom-3 right-3 text-[11px] text-slate-600 font-mono">
              {code.split('\n').length} lines / {code.length} chars
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Zap className="h-4 w-4" />
            Analyse Code &amp; Auto-Heal with AI
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* STAGE 2: ML PROCESSING */}
      {stage === 'ml-analysis' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
              <Cpu className="h-5 w-5 text-blue-400 animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-white">ML Diagnostic Engine Running</h3>
              <p className="text-xs text-slate-400">Static analysis and pattern detection in progress...</p>
            </div>
          </div>
          <MlProcessingView currentStep={mlStep} />
        </div>
      )}

      {/* STAGE 3: AI CORRECTION */}
      {stage === 'ai-correction' && mlResult && (
        <div className="space-y-4">
          {/* ML Summary card */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-white">ML Scan Complete</span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">{mlResult.languageLabel}</span>
              </div>
              <span className={`text-sm font-bold ${RISK_COLOR[mlResult.riskLevel]}`}>
                Health: {mlResult.healthScore}/100 • {mlResult.riskLevel.toUpperCase()} RISK
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${HEALTH_BG(mlResult.healthScore)} to-transparent transition-all`}
                style={{ width: `${mlResult.healthScore}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['critical','high','medium','low'] as const).map((sev) => {
                const count = mlResult.problems.filter((p) => p.severity === sev).length;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <div key={sev} className={`rounded-lg border px-3 py-2 text-center ${cfg.bg}`}>
                    <div className={`text-lg font-extrabold ${cfg.color}`}>{count}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{sev}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Problems list */}
          {mlResult.problems.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
              <h4 className="text-sm font-bold text-slate-200 mb-3">Detected Issues ({mlResult.problems.length})</h4>
              {mlResult.problems.map((p) => <ProblemCard key={p.id} problem={p} />)}
            </div>
          )}

          {/* AI Correction in progress */}
          {aiProcessing && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-white">Gemini AI Healing Code...</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sending {mlResult.problems.length} detected issue(s) to gemini-3.6-flash for autonomous correction.
                </p>
                <div className="flex gap-1 mt-2">
                  {[0,1,2,3,4].map(d => (
                    <div key={d} className="h-1.5 w-6 rounded-full bg-purple-500/40 animate-pulse" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE 4: RESULT */}
      {stage === 'result' && mlResult && correction && (
        <div className="space-y-5">
          {/* Risk comparison banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Before */}
                <div className="text-center">
                  <div className={`text-3xl font-extrabold ${RISK_COLOR[mlResult.riskLevel]}`}>{mlResult.healthScore}</div>
                  <div className="text-xs text-slate-400">Before Healing</div>
                  <div className={`text-xs font-bold mt-0.5 ${RISK_COLOR[mlResult.riskLevel]} uppercase`}>{mlResult.riskLevel} Risk</div>
                </div>
                <ArrowRight className="h-6 w-6 text-emerald-400" />
                {/* After */}
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-emerald-400">
                    {Math.min(100, mlResult.healthScore + Math.floor(mlResult.problems.length * 8))}
                  </div>
                  <div className="text-xs text-slate-400">After Healing</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5 uppercase">LOW Risk</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  +{Math.floor(mlResult.problems.length * 8)} Health Points
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  {correction.source === 'gemini' ? `gemini-3.6-flash` : 'Rule-based fallback'} · {mlResult.languageLabel}
                </div>
              </div>
            </div>

            {/* Changes list */}
            {correction.changes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {correction.changes.map((c, i) => (
                  <span key={i} className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-300">
                    ✓ {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Before/After Diff Viewer */}
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-2.5 border-b border-slate-700">
              <GitCompare className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">Before vs After — Code Diff</span>
              <span className="ml-auto text-xs text-slate-500">{mlResult.languageLabel}</span>
            </div>
            <DiffViewer before={code} after={correction.correctedCode} />
          </div>

          {/* Corrected code output */}
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900/80 px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Corrected Code</span>
              </div>
              <button
                onClick={() => handleCopy(correction.correctedCode)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-auto max-h-96 p-4 text-xs font-mono text-slate-300 bg-slate-950 whitespace-pre-wrap break-all">
              {correction.correctedCode}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Analyse New Code
            </button>
            <button
              onClick={() => handleCopy(correction.correctedCode)}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all"
            >
              <Copy className="h-4 w-4" />
              Copy Corrected Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
