import React, { useState, useEffect } from 'react';
import { getBackendConfig, saveBackendConfig, testSupabaseConnection } from '@/lib/backend/db';
import { setGeminiApiKey } from '@/lib/gemini';
import {
  Settings,
  X,
  KeyRound,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [geminiKey, setGeminiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [autoSave, setAutoSave] = useState(true);

  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getBackendConfig();
      setGeminiKey(cfg.geminiApiKey || '');
      setSupabaseUrl(cfg.supabaseUrl || '');
      setSupabaseKey(cfg.supabaseAnonKey || '');
      setAutoSave(cfg.autoSaveAnalyses ?? true);
      setSupabaseStatus(null);
      setSaveMessage(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseStatus(null);
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
      setSupabaseStatus(res);
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleSave = () => {
    saveBackendConfig({
      geminiApiKey: geminiKey.trim(),
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseKey.trim(),
      autoSaveAnalyses: autoSave,
    });
    setGeminiApiKey(geminiKey.trim());
    setSaveMessage(true);
    setTimeout(() => {
      setSaveMessage(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <Settings className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">System & Backend Settings</h3>
              <p className="text-[11px] text-slate-400">Configure AI models and persistent database integration</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Gemini Settings */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider">
            <KeyRound className="h-4 w-4 text-purple-400" /> Google Gemini API Integration
          </div>
          <p className="text-[11px] text-slate-400">
            Enables Generative AI reasoning for intelligent manifest auto-healing, JSON syntax correction, and problem mitigation.
          </p>

          <div>
            <label className="text-[11px] font-medium text-slate-300 block mb-1">Gemini API Key</label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              If left blank, ReleaseSentinel seamlessly uses its built-in deterministic heuristic auto-corrector.
            </p>
          </div>
        </div>

        {/* Supabase Settings */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 uppercase tracking-wider">
            <Database className="h-4 w-4 text-blue-400" /> Supabase Cloud PostgreSQL Backend
          </div>
          <p className="text-[11px] text-slate-400">
            Syncs release manifests, risk analysis runs, and simulation telemetry into your PostgreSQL cloud database.
          </p>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Supabase Project URL</label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Supabase Anon Key</label>
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={testingSupabase || !supabaseUrl.trim() || !supabaseKey.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {testingSupabase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Test Database Connection
              </button>

              <span className="text-[10px] text-slate-500">
                {supabaseUrl ? 'Cloud sync active' : 'Offline Local DB active'}
              </span>
            </div>

            {supabaseStatus && (
              <div
                className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                  supabaseStatus.ok
                    ? 'border border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                    : 'border border-rose-500/30 bg-rose-950/40 text-rose-300'
                }`}
              >
                {supabaseStatus.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 text-rose-400 shrink-0" />
                )}
                <span>{supabaseStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preferences */}
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 px-4">
          <div>
            <div className="text-xs font-medium text-slate-200">Auto-Save Release Analyses</div>
            <div className="text-[10px] text-slate-500">
              Automatically persist every evaluated release to history upon analysis completion
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoSave}
            onChange={(e) => setAutoSave(e.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
          />
        </div>

        {/* Save Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          {saveMessage ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Settings Saved!
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
            >
              <Save className="h-3.5 w-3.5" /> Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
