import type { ModuleRisk } from '@/types';
import { riskColor, moduleRiskIcon } from '@/lib/ui';

interface Props {
  moduleRisks: ModuleRisk[];
}

export function ModuleRiskChart({ moduleRisks }: Props) {
  const sorted = [...moduleRisks].sort((a, b) => b.risk - a.risk);
  const maxRisk = 100;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Risk by Module</h2>

      {/* Bar chart */}
      <div className="flex items-end justify-around gap-4 h-40 mb-4 px-2">
        {sorted.map((m) => (
          <div key={m.module} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-mono font-semibold text-slate-300">{m.risk}</span>
            <div
              className={`w-full max-w-[60px] rounded-t-md ${riskColor(m.risk)} transition-all duration-700 flex items-start justify-center pt-1`}
              style={{ height: `${(m.risk / maxRisk) * 100}%` }}
            >
              <span className="text-[10px]">{moduleRiskIcon(m.level)}</span>
            </div>
            <span className="text-[10px] text-slate-400 text-center leading-tight mt-1 truncate w-full">
              {m.module.replace('-service', '')}
            </span>
          </div>
        ))}
      </div>

      {/* Detail list */}
      <div className="space-y-2">
        {sorted.map((m) => (
          <div key={m.module} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
            <span className="text-lg">{moduleRiskIcon(m.level)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{m.module}</span>
                <span className="text-sm font-mono font-bold text-slate-300">{m.risk}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-700 mt-1">
                <div className={`h-full rounded-full ${riskColor(m.risk)}`} style={{ width: `${m.risk}%` }} />
              </div>
              {m.reasons.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {m.reasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-slate-500">{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
