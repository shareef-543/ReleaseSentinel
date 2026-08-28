import type { RolloutStrategy } from '@/types';
import { riskColor, riskTextColor } from '@/lib/ui';
import { Check } from 'lucide-react';

interface Props {
  strategies: RolloutStrategy[];
}

export function RolloutStrategies({ strategies }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Rollout Strategy Comparison</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
              <th className="text-left py-2 px-2 font-medium">Strategy</th>
              <th className="text-center py-2 px-2 font-medium">Exposure</th>
              <th className="text-center py-2 px-2 font-medium">Risk</th>
              <th className="text-center py-2 px-2 font-medium">Est. Impact</th>
              <th className="text-center py-2 px-2 font-medium">Affected Users</th>
              <th className="text-center py-2 px-2 font-medium">Rollback</th>
              <th className="text-center py-2 px-2 font-medium">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => (
              <tr
                key={s.percentage}
                className={`border-b border-slate-800/50 transition-colors ${s.recommended ? 'bg-cyan-500/5' : ''}`}
              >
                <td className="py-3 px-2">
                  <span className="font-semibold text-slate-200">{s.label}</span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`rounded border px-2 py-0.5 text-xs font-medium ${
                    s.exposure === 'Low' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                    s.exposure === 'Medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                    'text-red-400 bg-red-500/10 border-red-500/30'
                  }`}>{s.exposure}</span>
                </td>
                <td className="text-center py-3 px-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-700">
                      <div className={`h-full rounded-full ${riskColor(s.risk_score)}`} style={{ width: `${s.risk_score}%` }} />
                    </div>
                    <span className={`font-mono font-bold text-xs ${riskTextColor(s.risk_score)}`}>{s.risk_score}</span>
                  </div>
                </td>
                <td className="text-center py-3 px-2 font-mono text-slate-300">{s.estimated_failure_impact}</td>
                <td className="text-center py-3 px-2 font-mono text-slate-300">{s.estimated_affected_users.toLocaleString()}</td>
                <td className="text-center py-3 px-2">
                  <span className={`text-xs ${
                    s.rollback_difficulty === 'Easy' ? 'text-emerald-400' :
                    s.rollback_difficulty === 'Moderate' ? 'text-amber-400' :
                    'text-red-400'
                  }`}>{s.rollback_difficulty}</span>
                </td>
                <td className="text-center py-3 px-2">
                  {s.recommended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-xs font-bold text-cyan-300">
                      <Check className="h-3 w-3" /> Recommended
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
