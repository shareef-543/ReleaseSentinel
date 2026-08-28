import type { AnalysisResult } from '@/types';
import { riskColor, riskTextColor } from '@/lib/ui';

interface Props {
  analysis: AnalysisResult;
}

export function RiskSummary({ analysis }: Props) {
  const { risk_components: rc, overall_risk } = analysis;

  const factors = [
    { label: 'Code Risk', value: rc.code_change_risk, weight: '30%' },
    { label: 'Test Risk', value: rc.test_risk, weight: '20%' },
    { label: 'Historical Risk', value: rc.historical_risk, weight: '20%' },
    { label: 'Propagation Risk', value: rc.propagation_risk, weight: '15%' },
    { label: 'Production Impact', value: rc.production_impact, weight: '15%' },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Risk Summary</h2>
        <span className={`text-2xl font-bold ${riskTextColor(overall_risk)}`}>{overall_risk}<span className="text-sm text-slate-500">/100</span></span>
      </div>

      {/* Overall gauge */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Overall Release Risk</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${riskColor(overall_risk)} transition-all duration-700`}
            style={{ width: `${overall_risk}%` }}
          />
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-3">
        {factors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300">{f.label} <span className="text-slate-500">({f.weight})</span></span>
              <span className={`font-mono font-semibold ${riskTextColor(f.value)}`}>{f.value}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${riskColor(f.value)} transition-all duration-700`}
                style={{ width: `${f.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
