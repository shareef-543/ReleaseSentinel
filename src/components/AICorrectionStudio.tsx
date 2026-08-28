import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ReleaseManifest, FileMLAnalysisResult, FileProblem } from '@/types';
import { analyzeFileWithML } from '@/ml/fileProblemDetector';
import { correctManifestWithAI, isGeminiConfigured } from '@/lib/gemini';
import { saveCorrectionRecord, saveBackendConfig, getBackendConfig } from '@/lib/backend/db';
import { DiffViewer } from './DiffViewer';
import {
  Sparkles,
  Wand2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  FileCode,
  ArrowRight,
  Database,
  Copy,
  Download,
  Check,
  Loader2,
  FileText,
  KeyRound,
} from 'lucide-react';

interface AICorrectionStudioProps {
  onApplyManifest: (manifest: ReleaseManifest) => void;
  onNavigateToDashboard: () => void;
}

const SAMPLE_BROKEN_MANIFESTS = [
  {
    id: 'syntax_error',
    name: 'Broken Syntax & Trailing Commas',
    description: 'Contains unquoted keys, single quotes, and illegal trailing commas',
    snippet: `{\n  release_id: 'REL-2026-901',\n  changed_files: [\n    'services/payment/checkout_handler.go',\n    'services/payment/gateway.go',\n  ],\n  changed_modules: ['payment-service',],\n  tests: {\n    'passed': 42,\n    'failed': 0,\n    'flaky': 2,\n  },\n  dependencies: ['stripe-go-v74'],\n  test_coverage: 65,\n}`,
  },
  {
    id: 'flaky_test_anomaly',
    name: 'Severe Test Flakiness Anomaly',
    description: 'High flakiness ratio on critical tier-1 payment service',
    snippet: `{\n  "release_id": "REL-2026-902",\n  "changed_files": [\n    "payment/reconciliation.py",\n    "payment/stripe_client.py"\n  ],\n  "changed_modules": ["payment-service"],\n  "tests": {\n    "passed": 12,\n    "failed": 0,\n    "flaky": 18\n  },\n  "dependencies": ["stripe==11.0.0"],\n  "test_coverage": 58\n}`,
  },
  {
    id: 'missing_schema_drift',
    name: 'Schema Drift & Missing Modules',
    description: 'Raw file change list with no module tags or test object',
    snippet: `{\n  "release_id": "REL-2026-903",\n  "changed_files": [\n    "auth/jwt_validator.go",\n    "auth/session.go",\n    "checkout/cart_engine.go"\n  ]\n}`,
  },
  {
    id: 'blast_radius_anomaly',
    name: 'Multi-Service Blast Radius',
    description: 'Touches 5 distributed services simultaneously with infrastructure packages',
    snippet: `{\n  "release_id": "REL-2026-904",\n  "changed_files": [\n    "payment/service.go",\n    "auth/oauth.go",\n    "order/db.go",\n    "checkout/flow.go",\n    "notification/sms.go",\n    "config/database.yml",\n    "gateway/proxy.go"\n  ],\n  "changed_modules": [\n    "payment-service",\n    "auth-service",\n    "order-service",\n    "checkout-service",\n    "notification-service"\n  ],\n  "tests": {\n    "passed": 80,\n    "failed": 2,\n    "flaky": 14\n  },\n  "dependencies": ["redis-v9", "kafka-go", "grpc-v1.60"],\n  "test_coverage": 62\n}`,
  },
];

export function AICorrectionStudio({ onApplyManifest, onNavigateToDashboard }: AICorrectionStudioProps) {
  const [inputText, setInputText] = useState(SAMPLE_BROKEN_MANIFESTS[0].snippet);
  const [activeSample, setActiveSample] = useState(SAMPLE_BROKEN_MANIFESTS[0].id);
  const [analysisResult, setAnalysisResult] = useState<FileMLAnalysisResult | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctedManifest, setCorrectedManifest] = useState<ReleaseManifest | null>(null);
  const [correctedJsonStr, setCorrectedJsonStr] = useState<string | null>(null);
  const [appliedCorrections, setAppliedCorrections] = useState<string[]>([]);
  const [aiSource, setAiSource] = useState<'gemini' | 'fallback' | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isGeminiReady = isGeminiConfigured();

  // Run ML diagnostic whenever input text changes
  useEffect(() => {
    if (inputText.trim()) {
      const mlResult = analyzeFileWithML(inputText);
      setAnalysisResult(mlResult);
    } else {
      setAnalysisResult(null);
    }
    setSavedToDb(false);
  }, [inputText]);

  const handleSelectSample = (sample: (typeof SAMPLE_BROKEN_MANIFESTS)[0]) => {
    setActiveSample(sample.id);
    setInputText(sample.snippet);
    setCorrectedManifest(null);
    setCorrectedJsonStr(null);
    setAppliedCorrections([]);
    setAiExplanation(null);
    setSavedToDb(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setInputText(content);
      setActiveSample('');
      setCorrectedManifest(null);
      setCorrectedJsonStr(null);
      setSavedToDb(false);
    };
    reader.readAsText(file);
  };

  const handleRunAICorrection = async () => {
    if (!inputText.trim()) return;
    setIsCorrecting(true);
    setSavedToDb(false);

    try {
      const mlResult = analyzeFileWithML(inputText);
      const result = await correctManifestWithAI(inputText, mlResult.problems);
      const jsonStr = JSON.stringify(result.manifest, null, 2);

      setCorrectedManifest(result.manifest);
      setCorrectedJsonStr(jsonStr);
      setAppliedCorrections(result.corrections);
      setAiSource(result.source);
      setAiExplanation(result.explanation);

      // Auto save correction record to backend
      try {
        await saveCorrectionRecord(
          result.manifest,
          inputText,
          mlResult.problems.length,
          result.corrections.length,
          result.source,
        );
        setSavedToDb(true);
      } catch (err) {
        console.warn('Could not auto-save correction record:', err);
      }
    } catch (err) {
      alert(`Correction failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleSaveApiKey = () => {
    saveBackendConfig({ geminiApiKey: apiKeyInput.trim() });
    setShowKeyInput(false);
    setApiKeyInput('');
  };

  const handleApplyAndAnalyze = () => {
    if (correctedManifest) {
      onApplyManifest(correctedManifest);
      onNavigateToDashboard();
    }
  };

  const handleCopy = () => {
    if (!correctedJsonStr) return;
    navigator.clipboard.writeText(correctedJsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!correctedJsonStr) return;
    const blob = new Blob([correctedJsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${correctedManifest?.release_id || 'corrected-manifest'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categorizedProblemCounts = useMemo(() => {
    if (!analysisResult) return { critical: 0, high: 0, warning: 0, info: 0 };
    return {
      critical: analysisResult.problems.filter((p) => p.severity === 'critical').length,
      high: analysisResult.problems.filter((p) => p.severity === 'high').length,
      warning: analysisResult.problems.filter((p) => p.severity === 'warning').length,
      info: analysisResult.problems.filter((p) => p.severity === 'info').length,
    };
  }, [analysisResult]);

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                <Wand2 className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold text-white">ML Problem Diagnostic & AI Healing Studio</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Inspect corrupted manifests or code snippets using our multi-vector ML diagnostic model, identify syntax/schema/risk anomalies, and heal data with Generative AI before passing it to ReleaseSentinel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                isGeminiReady
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {isGeminiReady ? 'Gemini AI Ready' : 'Configure Gemini API Key'}
            </button>
          </div>
        </div>

        {/* API Key Modal Bar */}
        {showKeyInput && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 rounded-lg border border-purple-500/30 bg-purple-950/40 p-3">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste Google Gemini API Key (e.g. AIzaSy...)"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={handleSaveApiKey}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-all"
            >
              Save Key
            </button>
            <button
              onClick={() => setShowKeyInput(false)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Preset Problematic Scenarios */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Test with Real Problem Manifest Scenarios
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SAMPLE_BROKEN_MANIFESTS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className={`rounded-lg border p-3 text-left transition-all ${
                activeSample === sample.id
                  ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-xs text-white mb-1">{sample.name}</div>
              <div className="text-[11px] text-slate-400 line-clamp-2">{sample.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Editor & Upload (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Raw Manifest / File Input
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-600 transition-all"
                >
                  <Upload className="h-3 w-3" /> Upload File
                </button>
                <input ref={fileInputRef} type="file" accept=".json,.txt,.yaml,.yml" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setActiveSample('');
              }}
              placeholder="Paste JSON manifest, code snippet, or release parameters here..."
              rows={14}
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none leading-relaxed resize-y"
            />

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>{inputText.length} characters • {inputText.split('\n').length} lines</span>
              <span>{analysisResult?.isValidJson ? '✓ Valid JSON syntax' : '⚠ JSON syntax issues detected'}</span>
            </div>

            {/* AI Auto-Heal Trigger Button */}
            <button
              onClick={handleRunAICorrection}
              disabled={isCorrecting || !inputText.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/20"
            >
              {isCorrecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running ML Diagnosis & AI Auto-Healing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {isGeminiReady ? 'Run Gemini AI Auto-Healing' : 'Run Intelligent AI Auto-Healing'}
                </>
              )}
            </button>
          </div>

          {/* ML Feature Signal Meters */}
          {analysisResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
                <Activity className="h-4 w-4 text-purple-400" /> ML Feature Signal Matrix
              </div>
              <div className="space-y-2.5">
                {analysisResult.featureSignals.map((signal, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300">{signal.name}</span>
                      <span
                        className={`text-[11px] font-semibold font-mono ${
                          signal.impact === 'positive'
                            ? 'text-emerald-400'
                            : signal.impact === 'critical'
                            ? 'text-rose-400'
                            : signal.impact === 'negative'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {signal.value}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">{signal.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: ML Diagnostics & AI Healing Studio (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Health & Anomaly Summary Cards */}
          {analysisResult && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Health Score */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[11px] text-slate-400 mb-1">File Health Index</div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold font-mono ${
                      analysisResult.healthScore >= 80
                        ? 'text-emerald-400'
                        : analysisResult.healthScore >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {analysisResult.healthScore}%
                  </span>
                  <span className="text-xs text-slate-500">/ 100</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      analysisResult.healthScore >= 80
                        ? 'bg-emerald-500'
                        : analysisResult.healthScore >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${analysisResult.healthScore}%` }}
                  />
                </div>
              </div>

              {/* Anomaly Score */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[11px] text-slate-400 mb-1">ML Anomaly Rating</div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold font-mono ${
                      analysisResult.anomalyScore > 50
                        ? 'text-rose-400'
                        : analysisResult.anomalyScore > 20
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {analysisResult.anomalyScore}
                  </span>
                  <span className="text-xs text-slate-500">Anomaly Index</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      analysisResult.anomalyScore > 50
                        ? 'bg-rose-500'
                        : analysisResult.anomalyScore > 20
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${analysisResult.anomalyScore}%` }}
                  />
                </div>
              </div>

              {/* Problem Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[11px] text-slate-400 mb-1">Problems Detected</div>
                <div className="text-2xl font-bold text-white font-mono">{analysisResult.problems.length}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  {categorizedProblemCounts.critical > 0 && (
                    <span className="text-rose-400 font-semibold">{categorizedProblemCounts.critical} Critical</span>
                  )}
                  {categorizedProblemCounts.high > 0 && (
                    <span className="text-amber-400 font-semibold">{categorizedProblemCounts.high} High</span>
                  )}
                  {categorizedProblemCounts.warning > 0 && (
                    <span className="text-yellow-400">{categorizedProblemCounts.warning} Warn</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ML Identified Problems List */}
          {analysisResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Identified Problems & ML Anomalies ({analysisResult.problems.length})
                </span>
                <span className="text-[11px] text-slate-500">ML Confidence: 90-99%</span>
              </div>

              {analysisResult.problems.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
                  <div className="text-xs font-semibold text-emerald-300">No Problems Found!</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    This file conforms cleanly to the required ReleaseSentinel schema and passes all ML anomaly checks.
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {analysisResult.problems.map((problem: FileProblem) => (
                    <div
                      key={problem.id}
                      className={`rounded-lg border p-3 text-xs transition-all ${
                        problem.severity === 'critical'
                          ? 'border-rose-500/30 bg-rose-950/20 text-rose-200'
                          : problem.severity === 'high'
                          ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                          : problem.severity === 'warning'
                          ? 'border-yellow-500/30 bg-yellow-950/20 text-yellow-200'
                          : 'border-slate-700 bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {problem.severity === 'critical' ? (
                            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                          ) : problem.severity === 'high' ? (
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
                          )}
                          <span className="font-semibold text-white">{problem.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                            {problem.category}
                          </span>
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300 font-mono">
                            {problem.confidence}% conf
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 pl-5 mb-2 leading-relaxed">{problem.details}</p>

                      <div className="ml-5 flex items-start gap-1.5 rounded bg-slate-900/60 p-2 text-[11px] text-emerald-300 border border-emerald-500/20">
                        <Wand2 className="h-3 w-3 mt-0.5 text-emerald-400 shrink-0" />
                        <span>
                          <strong className="text-emerald-400 font-medium">AI Suggested Fix:</strong> {problem.suggestedFix}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Corrected Manifest Output & Diff View */}
          {correctedJsonStr && correctedManifest && (
            <div className="space-y-4">
              {/* Summary of corrections */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      {aiSource === 'gemini' ? 'Gemini AI Auto-Healing Completed' : 'AI Heuristic Auto-Healing Completed'}
                    </span>
                  </div>
                  {savedToDb && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <Database className="h-3 w-3" /> Auto-Saved to Backend
                    </span>
                  )}
                </div>

                {aiExplanation && <p className="text-xs text-slate-300 mb-3">{aiExplanation}</p>}

                {appliedCorrections.length > 0 && (
                  <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Applied Corrections:</div>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      {appliedCorrections.map((corr, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{corr}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Visual Diff Viewer */}
              <DiffViewer
                original={inputText}
                modified={correctedJsonStr}
                originalTitle="Corrupted Input File"
                modifiedTitle="Healed Production Manifest"
              />

              {/* Studio Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-all"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied to Clipboard' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-all"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Manifest
                  </button>
                </div>

                <button
                  onClick={handleApplyAndAnalyze}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/20"
                >
                  <span>Load into Risk Sentinel</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
