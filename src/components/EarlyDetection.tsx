import type { AnalysisResult } from '@/types';
import { decisionColor, decisionLabel } from '@/lib/ui';
import { Check, X, Shield, TrendingDown } from 'lucide-react';

interface Props {
  analysis: AnalysisResult;
}

export function EarlyDetection({ analysis }: Props) {
  const ciPass = analysis.traditional_ci.decision === 'RELEASE';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Early Detection vs Traditional CI</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Traditional CI */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
              {ciPass ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-red-400" />}
            </div>
            <span className="text-sm font-semibold text-slate-300">Traditional CI</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tests:</span>
              <span className={ciPass ? 'text-emerald-400' : 'text-red-400'}>{ciPass ? 'PASS' : 'FAIL'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Decision:</span>
              <span className="font-bold text-slate-300">{analysis.traditional_ci.decision.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{analysis.traditional_ci.reason}</p>
        </div>

        {/* ReleaseSentinel */}
        <div className={`rounded-lg border p-4 ${analysis.early_detection ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-300">ReleaseSentinel</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tests:</span>
              <span className={ciPass ? 'text-emerald-400' : 'text-red-400'}>{ciPass ? 'PASS' : 'FAIL'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Code Risk:</span>
              <span className="font-bold text-slate-300">{analysis.risk_components.code_change_risk}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Historical Risk:</span>
              <span className="font-bold text-slate-300">{analysis.risk_components.historical_risk}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Production Impact:</span>
              <span className="font-bold text-slate-300">{analysis.risk_components.production_impact}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Decision:</span>
              <span className={`font-bold ${decisionColor(analysis.decision).split(' ')[0]}`}>{decisionLabel(analysis.decision)}</span>
            </div>
          </div>
        </div>
      </div>

      {analysis.early_detection && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 mb-3">
          <p className="text-sm text-cyan-300 font-medium">
            ReleaseSentinel detected hidden release risk even though CI tests passed.
          </p>
        </div>
      )}

      {/* Impact reduction */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-slate-500 uppercase">Measurable Impact Reduction</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-slate-500">Traditional 100% Rollout</div>
            <div className="text-sm font-mono font-bold text-red-400">{analysis.impact_reduction.traditional_users.toLocaleString()}</div>
            <div className="text-[10px] text-slate-600">est. affected users</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">Sentinel {analysis.recommended_rollout}% Staged</div>
            <div className="text-sm font-mono font-bold text-emerald-400">{analysis.impact_reduction.sentinel_users.toLocaleString()}</div>
            <div className="text-[10px] text-slate-600">est. affected users</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">Reduction</div>
            <div className="text-lg font-mono font-bold text-emerald-400">{analysis.impact_reduction.reduction_pct}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
