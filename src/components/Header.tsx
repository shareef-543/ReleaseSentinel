import type { AnalysisResult } from '@/types';
import { decisionColor, decisionLabel, riskTextColor } from '@/lib/ui';
import { ShieldCheck, AlertTriangle, Activity, GitBranch } from 'lucide-react';

interface Props {
  releaseId: string;
  analysis: AnalysisResult | null;
  analyzing: boolean;
  progressStep: number;
}

export function Header({ releaseId, analysis, analyzing, progressStep }: Props) {
  const steps = [
    'Loading release manifest',
    'Computing code change risk',
    'Predicting test failures',
    'Analyzing defect propagation',
    'Finding similar incidents',
    'Estimating production impact',
    'Generating rollout strategies',
    'Producing AI recommendation',
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">ReleaseSentinel</h1>
              <p className="text-xs text-slate-400">Autonomous Software Release Risk Planner</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
              <GitBranch className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">Release:</span>
              <span className="text-sm font-mono font-semibold text-white">{releaseId}</span>
            </div>

            {analysis && !analyzing && (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${riskTextColor(analysis.overall_risk)}`}>
                <Activity className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {analysis.overall_risk >= 75 ? 'HIGH RISK' : analysis.overall_risk >= 50 ? 'MODERATE RISK' : 'LOW RISK'}
                </span>
                <span className="text-xs opacity-70">({analysis.overall_risk}/100)</span>
              </div>
            )}

            {analysis && !analyzing && (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${decisionColor(analysis.decision)}`}>
                <AlertTriangle className="h-4 w-4" />
                {decisionLabel(analysis.decision)}
              </div>
            )}
          </div>
        </div>

        {analyzing && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Running intelligence components...</span>
              <span>{progressStep + 1}/{steps.length}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${((progressStep + 1) / steps.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-cyan-400 font-medium">{steps[progressStep]}</p>
          </div>
        )}
      </div>
    </header>
  );
}
