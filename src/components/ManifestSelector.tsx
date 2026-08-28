import type { ReleaseManifest } from '@/types';
import { SAMPLE_MANIFESTS } from '@/data/seed';
import { Upload, Zap, Wand2, Loader2, AlertCircle, CheckCircle2, Sparkles, KeyRound, Copy, Download, Check } from 'lucide-react';
import { useState, useRef } from 'react';
import { correctManifestWithAI, isGeminiConfigured } from '@/lib/gemini';

interface Props {
  selectedManifest: ReleaseManifest;
  onSelectManifest: (m: ReleaseManifest) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  hasAnalysis: boolean;
}

interface CorrectionState {
  loading: boolean;
  corrections: string[] | null;
  source: 'gemini' | 'fallback' | null;
  error: string | null;
  correctedJson: string | null;
}

export function ManifestSelector({ selectedManifest, onSelectManifest, onAnalyze, analyzing, hasAnalysis }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [correction, setCorrection] = useState<CorrectionState>({
    loading: false,
    corrections: null,
    source: null,
    error: null,
    correctedJson: null,
  });
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geminiConfigured = isGeminiConfigured();

  function validateManifest(parsed: unknown): parsed is ReleaseManifest {
    return (
      !!parsed &&
      typeof parsed === 'object' &&
      'release_id' in parsed &&
      Array.isArray((parsed as Record<string, unknown>).changed_modules) &&
      'tests' in parsed
    );
  }

  function handleLoadJson() {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!validateManifest(parsed)) {
        setJsonError('Manifest must include release_id, changed_modules, and tests. Click "AI Correct" to auto-fix.');
        return;
      }
      onSelectManifest(parsed);
      setJsonError(null);
      setShowJson(false);
      setJsonInput('');
      setCorrection({ loading: false, corrections: null, source: null, error: null, correctedJson: null });
    } catch {
      setJsonError('Invalid JSON. Click "AI Correct" to let the AI repair it automatically.');
    }
  }

  async function handleAICorrect() {
    if (!jsonInput.trim()) {
      setCorrection({ loading: false, corrections: null, source: null, error: 'Paste some JSON first.', correctedJson: null });
      return;
    }

    setCorrection({ loading: true, corrections: null, source: null, error: null, correctedJson: null });

    try {
      const result = await correctManifestWithAI(jsonInput);
      const correctedJsonStr = JSON.stringify(result.manifest, null, 2);
      onSelectManifest(result.manifest);
      setCorrection({
        loading: false,
        corrections: result.corrections,
        source: result.source,
        error: null,
        correctedJson: correctedJsonStr,
      });
      setJsonError(null);
      setJsonInput(correctedJsonStr);
    } catch (err) {
      setCorrection({
        loading: false,
        corrections: null,
        source: null,
        error: err instanceof Error ? err.message : 'Failed to correct JSON.',
        correctedJson: null,
      });
    }
  }

  function handleCopyCorrected() {
    if (!correction.correctedJson) return;
    navigator.clipboard.writeText(correction.correctedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadCorrected() {
    if (!correction.correctedJson) return;
    const blob = new Blob([correction.correctedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedManifest.release_id || 'corrected-manifest'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      try {
        const parsed = JSON.parse(text);
        if (validateManifest(parsed)) {
          onSelectManifest(parsed);
          setJsonError(null);
        } else {
          // Auto-trigger AI correction for invalid uploaded files
          setJsonInput(text);
          setShowJson(true);
          setCorrection({ loading: true, corrections: null, source: null, error: null, correctedJson: null });
          try {
            const result = await correctManifestWithAI(text);
            const correctedJsonStr = JSON.stringify(result.manifest, null, 2);
            onSelectManifest(result.manifest);
            setCorrection({
              loading: false,
              corrections: result.corrections,
              source: result.source,
              error: null,
              correctedJson: correctedJsonStr,
            });
            setJsonInput(correctedJsonStr);
          } catch (err) {
            setCorrection({
              loading: false,
              corrections: null,
              source: null,
              error: err instanceof Error ? err.message : 'Failed to correct uploaded JSON.',
              correctedJson: null,
            });
          }
        }
      } catch {
        // Auto-trigger AI correction for broken JSON files
        setJsonInput(text);
        setShowJson(true);
        setCorrection({ loading: true, corrections: null, source: null, error: null, correctedJson: null });
        try {
          const result = await correctManifestWithAI(text);
          const correctedJsonStr = JSON.stringify(result.manifest, null, 2);
          onSelectManifest(result.manifest);
          setCorrection({
            loading: false,
            corrections: result.corrections,
            source: result.source,
            error: null,
            correctedJson: correctedJsonStr,
          });
          setJsonInput(correctedJsonStr);
        } catch (err) {
          setCorrection({
            loading: false,
            corrections: null,
            source: null,
            error: err instanceof Error ? err.message : 'Failed to correct uploaded JSON.',
            correctedJson: null,
          });
        }
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Release Manifest</h2>

      {/* Sample manifests */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-2">Sample Releases</div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_MANIFESTS.map((m) => (
            <button
              key={m.release_id}
              onClick={() => onSelectManifest(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-medium transition-all ${
                selectedManifest.release_id === m.release_id
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {m.release_id}
            </button>
          ))}
        </div>
      </div>

      {/* Current manifest details */}
      <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3 mb-4 space-y-2 text-xs">
        <div>
          <span className="text-slate-500">Modules: </span>
          <span className="text-slate-300">{selectedManifest.changed_modules.join(', ')}</span>
        </div>
        <div>
          <span className="text-slate-500">Files: </span>
          <span className="text-slate-300">{selectedManifest.changed_files.length} changed</span>
        </div>
        <div>
          <span className="text-slate-500">Tests: </span>
          <span className="text-emerald-400">{selectedManifest.tests.passed} passed</span>
          {selectedManifest.tests.failed > 0 && <span className="text-red-400">, {selectedManifest.tests.failed} failed</span>}
          {selectedManifest.tests.flaky > 0 && <span className="text-amber-400">, {selectedManifest.tests.flaky} flaky</span>}
        </div>
        <div>
          <span className="text-slate-500">Dependencies: </span>
          <span className="text-slate-300">{selectedManifest.dependencies.length > 0 ? selectedManifest.dependencies.join(', ') : 'none'}</span>
        </div>
        <div>
          <span className="text-slate-500">Coverage: </span>
          <span className="text-slate-300">{selectedManifest.test_coverage ?? 70}%</span>
        </div>
      </div>

      {/* Upload / JSON input */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-all"
        >
          <Upload className="h-3.5 w-3.5" /> Upload JSON
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />

        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-all"
        >
          Paste JSON
        </button>
      </div>

      {/* Gemini status badge */}
      <div className={`mb-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
        geminiConfigured
          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
          : 'border-slate-700 bg-slate-800/30 text-slate-500'
      }`}>
        <KeyRound className="h-3 w-3" />
        {geminiConfigured
          ? 'Gemini AI connected — auto-correction enabled'
          : 'Gemini API key not set — using deterministic fallback corrector'}
      </div>

      {showJson && (
        <div className="mb-4">
          <textarea
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setCorrection({ loading: false, corrections: null, source: null, error: null, correctedJson: null });
            }}
            placeholder='{"release_id":"REL-2026-XXX","changed_files":[...],"changed_modules":[...],"tests":{"passed":0,"failed":0,"flaky":0},"dependencies":[...]}'
            className="w-full h-32 rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
          />

          {jsonError && (
            <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{jsonError}</span>
            </div>
          )}

          {/* Correction results */}
          {correction.error && (
            <div className="flex items-start gap-1.5 mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{correction.error}</span>
            </div>
          )}

          {correction.corrections && correction.corrections.length > 0 && (
            <div className="mt-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                {correction.source === 'gemini' ? (
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                )}
                <span className="text-xs font-semibold text-cyan-300">
                  {correction.source === 'gemini' ? 'Gemini AI Corrections Applied' : 'Auto-Corrections Applied (Fallback)'}
                </span>
              </div>
              <ul className="space-y-0.5">
                {correction.corrections.map((c, i) => (
                  <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1">
                    <span className="text-cyan-500 mt-0.5">•</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Corrected JSON output panel */}
          {correction.correctedJson && (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">Corrected JSON Output</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCopyCorrected}
                    className="flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition-all"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownloadCorrected}
                    className="flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition-all"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </button>
                </div>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-[11px] font-mono leading-relaxed text-emerald-200">
{correction.correctedJson}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={handleLoadJson}
              className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-all"
            >
              Load Manifest
            </button>
            <button
              onClick={handleAICorrect}
              disabled={correction.loading || !jsonInput.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {correction.loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Correcting...
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  AI Correct
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={analyzing}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-bold text-white hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Zap className="h-4 w-4" />
        {analyzing ? 'Analyzing...' : hasAnalysis ? 'Re-run Risk Analysis' : 'Run Risk Analysis'}
      </button>
    </div>
  );
}
