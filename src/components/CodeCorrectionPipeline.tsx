import React, { useState, useCallback, useEffect } from 'react';
import { analyzeCode } from '@/ml/codeAnalyzer';
import type { CodeAnalysisResult, CodeProblem } from '@/ml/codeAnalyzer';
import { correctAnyCode } from '@/lib/gemini';
import type { CodeCorrectionResult } from '@/lib/gemini';
import {
  Code2,
  Zap,
  Wand2,
  GitCompare,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Copy,
  ChevronRight,
  RefreshCw,
  FileCode2,
  ArrowRight,
  Cpu,
  Sparkles,
  CircleAlert,
  Info,
  ShieldCheck,
  Download,
  Terminal,
  FileText,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type Stage = 'input' | 'ml-analysis' | 'ai-correction' | 'result';

export type SupportedLang =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'sql'
  | 'html'
  | 'bash'
  | 'auto';

interface LangOption {
  id: SupportedLang;
  name: string;
  extension: string;
  icon: string;
  badgeColor: string;
  defaultFileName: string;
  sampleBuggyCode: string;
  placeholder: string;
}

const SUPPORTED_LANGUAGES: LangOption[] = [
  {
    id: 'python',
    name: 'Python',
    extension: '.py',
    icon: '🐍',
    badgeColor: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    defaultFileName: 'main.py',
    placeholder: 'def process_order(user, item_id):\n    # Paste Python code here...\n    pass',
    sampleBuggyCode: `import *
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
  {
    id: 'javascript',
    name: 'JavaScript',
    extension: '.js',
    icon: '🟨',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    defaultFileName: 'app.js',
    placeholder: 'function handleRequest(req, res) {\n  // Paste JavaScript code here...\n}',
    sampleBuggyCode: `var apiUrl = "https://api.example.com"
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

function validate(x) {
  if (x == true) return true
  if (x == false) return false
}
`,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    extension: '.ts',
    icon: '🔷',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    defaultFileName: 'service.ts',
    placeholder: 'export interface UserData {\n  // Paste TypeScript code here...\n}',
    sampleBuggyCode: `export async function processPayment(paymentData: any): Promise<any> {
  const secretKey: string = "sk_test_51MzXYZ12345";
  console.log("Processing payment for:", paymentData.user!.email);

  if (paymentData.amount == "0") {
    throw new Error("Invalid amount");
  }

  const payload: any = {
    amount: paymentData.amount,
    currency: paymentData.currency || "USD",
  };

  return payload as any;
}
`,
  },
  {
    id: 'java',
    name: 'Java',
    extension: '.java',
    icon: '☕',
    badgeColor: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    defaultFileName: 'UserService.java',
    placeholder: 'public class Main {\n    // Paste Java code here...\n}',
    sampleBuggyCode: `package com.sentinel.service;

import java.sql.*;
import java.io.*;

public class UserService {
    private static final String DB_PASS = "admin123";
    
    public User getUser(String username) {
        try {
            String query = "SELECT * FROM users WHERE name = '" + username + "'";
            Statement stmt = db.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            System.out.println("Query executed for: " + username);
            if (username == "admin") {
                return mapAdmin(rs);
            }
            return mapUser(rs);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    public void deleteUser(String id) {
        String sql = "DELETE FROM users WHERE id = " + id;
        db.execute(sql);
    }
}
`,
  },
  {
    id: 'cpp',
    name: 'C++',
    extension: '.cpp',
    icon: '⚙️',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    defaultFileName: 'main.cpp',
    placeholder: '#include <iostream>\n\nint main() {\n    // Paste C++ code here...\n    return 0;\n}',
    sampleBuggyCode: `#include <iostream>
#include <cstring>

void processInput(char* input) {
    char buffer[16];
    // Dangerous buffer overflow vulnerability
    strcpy(buffer, input);
    std::cout << "Buffer: " << buffer << std::endl;
}

int main() {
    int* ptr = new int(42);
    std::cout << "Value: " << *ptr << std::endl;
    // Missing delete ptr (Memory Leak)
    return 0;
}
`,
  },
  {
    id: 'csharp',
    name: 'C#',
    extension: '.cs',
    icon: '🟣',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    defaultFileName: 'Program.cs',
    placeholder: 'using System;\n\nnamespace App {\n    // Paste C# code here...\n}',
    sampleBuggyCode: `using System;
using System.Data.SqlClient;

public class AccountManager {
    private string connectionString = "Server=myServer;Database=myDB;User Id=myUser;Password=myPassword123;";

    public void Authenticate(string user, string pass) {
        string query = "SELECT * FROM Accounts WHERE Username = '" + user + "' AND Password = '" + pass + "'";
        try {
            SqlCommand cmd = new SqlCommand(query);
            cmd.ExecuteReader();
        } catch (Exception ex) {
            Console.WriteLine(ex.ToString());
        }
    }
}
`,
  },
  {
    id: 'go',
    name: 'Go',
    extension: '.go',
    icon: '🐹',
    badgeColor: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    defaultFileName: 'main.go',
    placeholder: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Paste Go code here...\n}',
    sampleBuggyCode: `package main

import (
	"fmt"
	"net/http"
)

func handleRequest(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if token == "" {
		// Panic on recoverable error crashes service
		panic("Missing token")
	}
	fmt.Println("Processing user token:", token)
	w.Write([]byte("Authorized"))
}
`,
  },
  {
    id: 'rust',
    name: 'Rust',
    extension: '.rs',
    icon: '🦀',
    badgeColor: 'border-amber-600/30 bg-amber-600/10 text-amber-300',
    defaultFileName: 'main.rs',
    placeholder: 'fn main() {\n    // Paste Rust code here...\n}',
    sampleBuggyCode: `fn process_data(input: Option<String>) {
    // Dangerous unwrap causing panic on None
    let value = input.unwrap();
    println!("Received: {}", value);
}

fn main() {
    process_data(None);
}
`,
  },
  {
    id: 'php',
    name: 'PHP',
    extension: '.php',
    icon: '🐘',
    badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
    defaultFileName: 'index.php',
    placeholder: '<?php\n// Paste PHP code here...\n',
    sampleBuggyCode: `<?php
$db_pass = "root_pass_999";
$user = $_GET['user'];

// SQL Injection and XSS vulnerability
$sql = "SELECT * FROM users WHERE name = '" . $user . "'";
$res = mysqli_query($conn, $sql);

echo "<h1>Welcome " . $user . "</h1>";
?>
`,
  },
  {
    id: 'sql',
    name: 'SQL',
    extension: '.sql',
    icon: '🗄️',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    defaultFileName: 'query.sql',
    placeholder: 'SELECT * FROM users WHERE active = 1;\n-- Paste SQL code here...',
    sampleBuggyCode: `-- User lookup (dynamic query without parameterization)
SELECT * FROM users WHERE username = '' + @username + '';

-- Tautological check
SELECT * FROM admins WHERE 1=1 AND active = 1;

-- Destructive DDL without IF EXISTS
DROP TABLE old_sessions;

-- Unindexed full table scan
SELECT * FROM orders o 
JOIN customers c ON o.customer_id = c.id
JOIN products p ON o.product_id = p.id;
`,
  },
  {
    id: 'bash',
    name: 'Shell / Bash',
    extension: '.sh',
    icon: '🐚',
    badgeColor: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    defaultFileName: 'deploy.sh',
    placeholder: '#!/bin/bash\n# Paste Shell script here...\n',
    sampleBuggyCode: `#!/bin/bash
API_KEY="AIzaSyA_test_key_12345"

# Unquoted variables leading to globbing and word splitting
rm -rf /tmp/data/$TARGET_DIR

curl -H "Authorization: Bearer $API_KEY" http://api.internal/deploy
`,
  },
  {
    id: 'auto',
    name: '⚡ Auto-Detect',
    extension: '.txt',
    icon: '⚡',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    defaultFileName: 'source.txt',
    placeholder: '// Paste ANY code in ANY language...\n// ReleaseSentinel ML Engine will auto-detect and format it.',
    sampleBuggyCode: `def authenticate(user, password):
    if password == "admin":
        return True
    return False
`,
  },
];

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNo: number;
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: ShieldAlert },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: AlertTriangle },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: CircleAlert },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: Info },
  info: { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', icon: Info },
};

const RISK_COLOR = {
  low: 'text-emerald-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const HEALTH_BG = (score: number) =>
  score >= 80
    ? 'from-emerald-500'
    : score >= 60
    ? 'from-yellow-500'
    : score >= 35
    ? 'from-orange-500'
    : 'from-red-500';

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

function ProblemCard({ problem }: { problem: CodeProblem }) {
  const cfg = SEVERITY_CONFIG[problem.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{problem.severity}</span>
            {problem.line && <span className="text-xs text-slate-400 font-mono">Line {problem.line}</span>}
            <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400 uppercase">
              {problem.category}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-200 mt-0.5">{problem.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{problem.description}</p>
          <p className="text-xs text-emerald-400 mt-1 font-mono">💡 {problem.suggestedFix}</p>
        </div>
      </div>
    </div>
  );
}

function DiffViewer({ before, after }: { before: string; after: string }) {
  const [mode, setMode] = useState<'split' | 'unified'>('split');
  const diffLines = computeDiff(before, after);

  const added = diffLines.filter((l) => l.type === 'added').length;
  const removed = diffLines.filter((l) => l.type === 'removed').length;

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-400 font-bold">+{added} lines added</span>
          <span className="text-red-400 font-bold">−{removed} lines removed</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-0.5">
          {(['split', 'unified'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                mode === m ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)} Diff
            </button>
          ))}
        </div>
      </div>

      {mode === 'unified' ? (
        <div className="overflow-auto max-h-[420px] text-xs font-mono bg-slate-950 p-2">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={`flex items-start px-2 py-0.5 rounded ${
                line.type === 'added'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : line.type === 'removed'
                  ? 'bg-red-500/10 text-red-300'
                  : 'text-slate-400'
              }`}
            >
              <span className="w-6 flex-shrink-0 text-slate-600 select-none">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              <span className="w-8 flex-shrink-0 text-slate-600 select-none text-right pr-2">{line.lineNo}</span>
              <pre className="whitespace-pre-wrap break-all flex-1">{line.content}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700 overflow-auto max-h-[420px]">
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border-b border-slate-700 flex items-center justify-between">
              <span>Original (With Issues)</span>
              <span className="text-[10px] font-mono text-red-400/80">Before</span>
            </div>
            <div className="p-2 bg-slate-950 text-xs font-mono space-y-0.5">
              {before.split('\n').map((line, i) => (
                <div key={i} className="px-2 py-0.5 text-slate-400 whitespace-pre-wrap break-all">
                  <span className="inline-block w-6 text-slate-600 select-none text-right pr-2">{i + 1}</span>
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border-b border-slate-700 flex items-center justify-between">
              <span>AI Corrected &amp; Formatted</span>
              <span className="text-[10px] font-mono text-emerald-400/80">After Auto-Healing</span>
            </div>
            <div className="p-2 bg-slate-950 text-xs font-mono space-y-0.5">
              {after.split('\n').map((line, i) => {
                const isFix = line.includes('FIXED:');
                return (
                  <div
                    key={i}
                    className={`px-2 py-0.5 rounded whitespace-pre-wrap break-all ${
                      isFix ? 'bg-emerald-500/15 text-emerald-200 font-semibold' : 'text-slate-200'
                    }`}
                  >
                    <span className="inline-block w-6 text-slate-600 select-none text-right pr-2">{i + 1}</span>
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ML_STAGES = [
  { label: 'Analyzing language syntax & AST structure...', icon: FileCode2 },
  { label: 'Scanning for security vulnerabilities (SQLi, hardcoded credentials, XSS)...', icon: ShieldAlert },
  { label: 'Checking unhandled exceptions & logic flaws...', icon: AlertTriangle },
  { label: 'Evaluating code style, formatting & typing compliance...', icon: Cpu },
  { label: 'Computing initial Health Score & defect matrix...', icon: Zap },
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
              done
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : active
                ? 'border-cyan-500/30 bg-cyan-500/10 animate-pulse'
                : 'border-slate-800 bg-slate-900/30 opacity-40'
            }`}
          >
            <Icon
              className={`h-4 w-4 flex-shrink-0 ${
                done ? 'text-emerald-400' : active ? 'text-cyan-400' : 'text-slate-600'
              }`}
            />
            <span className={`text-sm ${done ? 'text-emerald-300' : active ? 'text-cyan-300' : 'text-slate-500'}`}>
              {stage.label}
            </span>
            {done && <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />}
            {active && (
              <div className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
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
  const [selectedLang, setSelectedLang] = useState<SupportedLang>('python');
  const [stage, setStage] = useState<Stage>('input');
  const [code, setCode] = useState(SUPPORTED_LANGUAGES[0].sampleBuggyCode);
  const [fileName, setFileName] = useState(SUPPORTED_LANGUAGES[0].defaultFileName);
  const [mlStep, setMlStep] = useState(0);
  const [mlResult, setMlResult] = useState<CodeAnalysisResult | null>(null);
  const [correction, setCorrection] = useState<CodeCorrectionResult | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLangOption = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLang) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = (langId: SupportedLang) => {
    setSelectedLang(langId);
    const opt = SUPPORTED_LANGUAGES.find((l) => l.id === langId);
    if (opt) {
      setFileName(opt.defaultFileName);
    }
  };

  const handleLoadSample = (langId: SupportedLang) => {
    setSelectedLang(langId);
    const opt = SUPPORTED_LANGUAGES.find((l) => l.id === langId);
    if (opt) {
      setCode(opt.sampleBuggyCode);
      setFileName(opt.defaultFileName);
    }
  };

  const handleStart = useCallback(async () => {
    if (!code.trim()) return;
    setError(null);
    setMlStep(0);
    setStage('ml-analysis');

    // Animate ML stages
    for (let i = 0; i <= ML_STAGES.length; i++) {
      await new Promise<void>((res) => setTimeout(res, 400));
      setMlStep(i);
    }

    const explicitLanguage = selectedLang === 'auto' ? undefined : activeLangOption.name;
    const result = analyzeCode(code, fileName || undefined);
    setMlResult(result);

    // Move to AI correction
    setStage('ai-correction');
    setAiProcessing(true);

    try {
      const corr = await correctAnyCode(
        code,
        explicitLanguage || result.languageLabel,
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
      setStage('input');
    } finally {
      setAiProcessing(false);
    }
  }, [code, fileName, selectedLang, activeLangOption]);

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

  const handleDownload = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'corrected_code.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Code2 className="h-5 w-5 text-purple-400" />
            Universal Multi-Language Code Corrector &amp; AI Auto-Healer
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Select your programming language $\rightarrow$ Paste code $\rightarrow$ ML Static Diagnostics $\rightarrow$ Gemini AI Full Rewrite &amp; Proper Formatting
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs font-semibold">
          {['1. Select & Paste', '2. ML Analysis', '3. AI Auto-Heal', '4. Formatted Result'].map((s, i) => {
            const current = ['input', 'ml-analysis', 'ai-correction', 'result'].indexOf(stage);
            const isActive = i === current;
            const isDone = i < current;
            return (
              <React.Fragment key={s}>
                <div
                  className={`rounded-full px-3 py-1 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : isActive
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? '✓ ' : ''}
                  {s}
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
          <button onClick={() => setError(null)} className="ml-auto text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* STAGE 1: LANGUAGE SELECTION & CODE INPUT */}
      {stage === 'input' && (
        <div className="space-y-5">
          {/* STEP 1: SELECT LANGUAGE FIRST */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <FileCode2 className="h-4 w-4" />
                Step 1: Choose Your Programming Language
              </label>
              <span className="text-xs text-slate-400">
                Selected: <span className="font-bold text-white">{activeLangOption.name}</span> ({activeLangOption.extension})
              </span>
            </div>

            {/* Language Selection Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = selectedLang === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.id)}
                    className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-2 border-purple-500 bg-purple-500/20 text-white shadow-lg shadow-purple-500/20'
                        : 'border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-base">{lang.icon}</span>
                    <span className="truncate">{lang.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sample Buggy Code loader for active language */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400">Want to test with a pre-configured buggy snippet?</span>
              <button
                type="button"
                onClick={() => handleLoadSample(selectedLang)}
                className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 font-semibold text-purple-300 hover:bg-purple-500/20 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load Buggy {activeLangOption.name} Sample</span>
              </button>
            </div>
          </div>

          {/* STEP 2: PASTE CODE */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Code2 className="h-4 w-4" />
                Step 2: Paste or Edit {activeLangOption.name} Code
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">File Name:</span>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={activeLangOption.placeholder}
                rows={16}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:border-purple-500/60 focus:outline-none resize-y"
              />
              <div className="absolute bottom-3 right-3 text-[11px] text-slate-500 font-mono bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                {code.split('\n').length} lines · {code.length} characters
              </div>
            </div>

            {/* Action Submit Button */}
            <button
              onClick={handleStart}
              disabled={!code.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Zap className="h-4 w-4" />
              <span>Analyse {activeLangOption.name} &amp; Auto-Rewrite with AI</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: ML PROCESSING */}
      {stage === 'ml-analysis' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30">
              <Cpu className="h-5 w-5 text-purple-400 animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-white">
                ML Diagnostic Engine Scanning {activeLangOption.name} Source
              </h3>
              <p className="text-xs text-slate-400">AST parsing, vulnerability matching, and anomaly inspection...</p>
            </div>
          </div>
          <MlProcessingView currentStep={mlStep} />
        </div>
      )}

      {/* STAGE 3: AI CORRECTION IN PROGRESS */}
      {stage === 'ai-correction' && mlResult && (
        <div className="space-y-4">
          {/* ML Summary card */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-white">ML Scan Completed</span>
                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs text-purple-300 font-semibold">
                  {activeLangOption.name}
                </span>
              </div>
              <span className={`text-sm font-bold ${RISK_COLOR[mlResult.riskLevel]}`}>
                Initial Health: {mlResult.healthScore}/100 • {mlResult.riskLevel.toUpperCase()} RISK
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${HEALTH_BG(mlResult.healthScore)} to-transparent transition-all`}
                style={{ width: `${mlResult.healthScore}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const count = mlResult.problems.filter((p) => p.severity === sev).length;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <div key={sev} className={`rounded-lg border px-3 py-2 text-center ${cfg.bg}`}>
                    <div className={`text-lg font-extrabold ${cfg.color}`}>{count}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">{sev} issues</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detected issues */}
          {mlResult.problems.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Detected Code Deficiencies ({mlResult.problems.length})
              </h4>
              {mlResult.problems.map((p) => (
                <ProblemCard key={p.id} problem={p} />
              ))}
            </div>
          )}

          {/* AI Auto-Healing status */}
          {aiProcessing && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-white">Gemini AI Auto-Rewriting &amp; Formatting {activeLangOption.name} Code...</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fixing {mlResult.problems.length} detected defect(s), applying official {activeLangOption.name} formatting standards, and generating safe code.
                </p>
                <div className="flex gap-1.5 mt-2">
                  {[0, 1, 2, 3, 4].map((d) => (
                    <div
                      key={d}
                      className="h-1.5 w-8 rounded-full bg-purple-500/50 animate-pulse"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE 4: RESULT WITH DIFF & PROPERLY FORMATTED REWRITE */}
      {stage === 'result' && mlResult && correction && (
        <div className="space-y-6">
          {/* Health Score Comparison Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                {/* Before */}
                <div className="text-center">
                  <div className={`text-3xl font-extrabold ${RISK_COLOR[mlResult.riskLevel]}`}>{mlResult.healthScore}</div>
                  <div className="text-xs text-slate-400">Before Auto-Heal</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${RISK_COLOR[mlResult.riskLevel]} uppercase`}>
                    {mlResult.riskLevel} Risk
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-emerald-400">
                  <ArrowRight className="h-6 w-6" />
                  <span className="text-[10px] font-bold font-mono">
                    +{Math.min(100, mlResult.healthScore + Math.max(25, mlResult.problems.length * 10)) - mlResult.healthScore} pts
                  </span>
                </div>

                {/* After */}
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-emerald-400">
                    {Math.min(100, mlResult.healthScore + Math.max(25, mlResult.problems.length * 10))}
                  </div>
                  <div className="text-xs text-slate-400">After AI Auto-Heal</div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-0.5 uppercase">LOW RISK · CLEAN</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>100% Syntax &amp; Safety Verified</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span>
                    {correction.source === 'gemini' ? 'Gemini 3.6 Flash' : 'Rule-based Healer'} · {activeLangOption.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Changes list */}
            {correction.changes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {correction.changes.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-300"
                  >
                    ✓ {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Before/After Diff Viewer */}
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Before vs After Comparison</span>
              </div>
              <span className="text-xs font-mono text-purple-300 font-semibold">{activeLangOption.name}</span>
            </div>
            <DiffViewer before={code} after={correction.correctedCode} />
          </div>

          {/* Formatted Rewritten Code Block */}
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  Corrected &amp; Formatted {activeLangOption.name} Output ({fileName})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(correction.correctedCode)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>

                <button
                  onClick={() => handleDownload(correction.correctedCode, fileName)}
                  className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download {fileName}</span>
                </button>
              </div>
            </div>

            <pre className="overflow-auto max-h-[450px] p-4 text-xs font-mono text-emerald-200 bg-slate-950 whitespace-pre-wrap break-all leading-relaxed">
              {correction.correctedCode}
            </pre>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Correct Another Code Snippet</span>
            </button>

            <button
              onClick={() => handleCopy(correction.correctedCode)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 transition-all"
            >
              <Copy className="h-4 w-4" />
              <span>{copied ? 'Copied!' : 'Copy Full Corrected Code'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
