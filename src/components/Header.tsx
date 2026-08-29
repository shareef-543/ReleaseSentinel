import React from 'react';
import type { AnalysisResult } from '@/types';
import { decisionColor, decisionLabel, riskTextColor } from '@/lib/ui';
import { getBackendConfig } from '@/lib/backend/db';
import { isGeminiConfigured } from '@/lib/gemini';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  GitBranch,
  Wand2,
  Database,
  LayoutDashboard,
  Settings,
  Sparkles,
  Zap,
  Code2,
  ShieldAlert,
  Brain,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';

interface Props {
  releaseId: string;
  analysis: AnalysisResult | null;
  analyzing: boolean;
  progressStep: number;
  activeView: 'pipeline' | 'code' | 'dashboard' | 'studio' | 'history' | 'admin' | 'ml';
  onSelectView: (view: 'pipeline' | 'code' | 'dashboard' | 'studio' | 'history' | 'admin' | 'ml') => void;
  onOpenSettings: () => void;
}

export function Header({
  releaseId,
  analysis,
  analyzing,
  progressStep,
  activeView,
  onSelectView,
  onOpenSettings,
}: Props) {
  const { user, isAuthenticated, isAdmin, isLead, logout, openAuthModal } = useAuth();

  const steps = [
    'Loading release manifest',
    'Computing code change risk',
    'Predicting test failures with ML',
    'Analyzing defect propagation graph',
    'TF-IDF incident NLP similarity search',
    'Estimating blast radius & user impact',
    'Generating optimal rollout strategies',
    'Synthesizing autonomous release decision',
  ];

  const config = getBackendConfig();
  const hasSupabase = !!config.supabaseUrl;
  const hasGemini = isGeminiConfigured();

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Navigation Tabs */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onSelectView('pipeline')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-600 shadow-md shadow-cyan-500/20">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  ReleaseSentinel
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
                    ML+AI Engine
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400">Autonomous Release Risk & AI Auto-Healing</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
              <button
                onClick={() => onSelectView('pipeline')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'pipeline'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Risk Pipeline</span>
              </button>

              <button
                onClick={() => onSelectView('code')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'code'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Code Corrector</span>
              </button>

              <button
                onClick={() => onSelectView('dashboard')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'dashboard'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Risk Sentinel Dashboard</span>
              </button>

              <button
                onClick={() => onSelectView('studio')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'studio'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>ML & AI Studio</span>
              </button>

              <button
                onClick={() => onSelectView('ml')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'ml'
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 text-white shadow-sm'
                    : 'text-purple-300 hover:text-white hover:bg-purple-900/30'
                }`}
              >
                <Brain className="h-3.5 w-3.5 text-purple-400" />
                <span>ML Studio</span>
              </button>

              <button
                onClick={() => onSelectView('history')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'history'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Backend History</span>
              </button>

              {/* Admin Tab (Visible only to Admin or Lead) */}
              {(isAdmin || isLead) && (
                <button
                  onClick={() => onSelectView('admin')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activeView === 'admin'
                      ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white shadow-sm'
                      : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/30'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Admin Console</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Status Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {activeView === 'dashboard' && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-2.5 py-1.5 text-xs">
                <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400">Active:</span>
                <span className="font-mono font-bold text-cyan-300">{releaseId}</span>
              </div>
            )}

            {activeView === 'dashboard' && analysis && !analyzing && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${riskTextColor(analysis.overall_risk)}`}>
                <Activity className="h-3.5 w-3.5" />
                <span>{analysis.overall_risk}/100</span>
              </div>
            )}

            {activeView === 'dashboard' && analysis && !analyzing && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${decisionColor(analysis.decision)}`}>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{decisionLabel(analysis.decision)}</span>
              </div>
            )}

            {/* Cloud & AI Badges */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px]">
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 border ${
                  hasGemini
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                    : 'border-slate-800 bg-slate-800/30 text-slate-500'
                }`}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {hasGemini ? 'Gemini AI' : 'Heuristic AI'}
              </span>

              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 border ${
                  hasSupabase
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                <Database className="h-2.5 w-2.5" />
                {hasSupabase ? 'Supabase' : 'Local DB'}
              </span>
            </div>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              title="System & Backend Settings"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* User Profile / Auth Status */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-1 pl-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white uppercase">
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-slate-200 truncate max-w-[100px] leading-tight">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-purple-400 uppercase font-mono leading-tight">
                      {user.role}
                    </div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400 transition-all"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-step progress bar during analysis */}
        {analyzing && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-cyan-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                {steps[progressStep]}
              </span>
              <span className="font-mono">{progressStep + 1}/{steps.length}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 transition-all duration-300"
                style={{ width: `${((progressStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
