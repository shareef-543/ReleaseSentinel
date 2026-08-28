import type { PredictedFailureMode } from '@/types';
import { riskColor, riskTextColor } from '@/lib/ui';

interface Props {
  failureModes: PredictedFailureMode[];
  predictedProbability: number;
}

export function FailureModes({ failureModes, predictedProbability }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Predicted Failure Modes</h2>
        <div className="text-right">
          <div className="text-xs text-slate-500">Predicted Failure Probability</div>
          <div className={`text-lg font-bold ${riskTextColor(predictedProbability)}`}>{predictedProbability}%</div>
        </div>
      </div>

      <div className="space-y-3">
        {failureModes.map((fm, idx) => (
          <div key={fm.mode} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">{idx + 1}</span>
                <span className="text-sm font-medium text-slate-200">{fm.label}</span>
              </div>
              <span className={`text-sm font-mono font-bold ${riskTextColor(fm.probability)}`}>{fm.probability}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700 mb-2">
              <div className={`h-full rounded-full ${riskColor(fm.probability)} transition-all duration-700`} style={{ width: `${fm.probability}%` }} />
            </div>
            {fm.reasons.length > 0 && (
              <div className="text-[11px] text-slate-500">{fm.reasons.join(' • ')}</div>
            )}
          </div>
        ))}
        {failureModes.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-4">No significant failure modes predicted.</div>
        )}
      </div>
    </div>
  );
}
