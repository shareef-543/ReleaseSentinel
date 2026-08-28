import type { RolloutSimulation, Reassessment } from '@/types';
import { statusColor, statusBg, statusLabel, decisionColor, decisionLabel } from '@/lib/ui';
import { Play, RotateCcw, GitMerge, RefreshCw } from 'lucide-react';

interface Props {
  simulation: RolloutSimulation | null;
  reassessment: Reassessment | null;
  onSimulate: (pct: number) => void;
  onReassess: () => void;
  onReset: () => void;
}

export function SimulationPanel({ simulation, reassessment, onSimulate, onReassess, onReset }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Staged Rollout Simulation</h2>
        {simulation && (
          <button onClick={onReset} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Simulate buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[10, 50, 100].map((pct) => (
          <button
            key={pct}
            onClick={() => onSimulate(pct)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
              simulation?.percentage === pct
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            Simulate {pct}% Rollout
          </button>
        ))}
      </div>

      {/* Simulation results */}
      {simulation && (
        <div className="space-y-4">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${statusBg(simulation.status)}`}>
            <GitMerge className="h-4 w-4" />
            <span className="text-sm font-semibold">{simulation.percentage}% Rollout</span>
            <span className={`ml-auto text-xs font-bold uppercase ${statusColor(simulation.status)}`}>
              {statusLabel(simulation.status)}
            </span>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            {simulation.metrics.map((m) => (
              <div key={m.label} className="rounded-lg border border-slate-800 bg-slate-800/30 p-2.5">
                <div className="text-[10px] text-slate-500 uppercase mb-0.5">{m.label}</div>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-mono font-bold ${statusColor(m.status)}`}>{m.value}</span>
                  {m.delta && (
                    <span className={`text-[10px] font-mono ${statusColor(m.status)}`}>{m.delta}</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-600">Baseline: {m.baseline}</div>
              </div>
            ))}
          </div>

          {/* Feedback loop: predicted vs observed */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <div className="text-xs text-slate-500 uppercase mb-2">Feedback Loop — Predicted vs Observed</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-500">Predicted Error Rate</div>
                <div className="text-sm font-mono font-bold text-slate-300">{simulation.predicted_error_rate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Observed Error Rate</div>
                <div className={`text-sm font-mono font-bold ${statusColor(simulation.status)}`}>{simulation.error_rate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Deviation</div>
                <div className={`text-sm font-mono font-bold ${simulation.prediction_deviation > 0.5 ? 'text-red-400' : simulation.prediction_deviation < -0.5 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {simulation.prediction_deviation >= 0 ? '+' : ''}{simulation.prediction_deviation.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Reassess button */}
          {!reassessment && (
            <button
              onClick={onReassess}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Reassess Decision Based on Observations
            </button>
          )}

          {/* Reassessment result */}
          {reassessment && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="text-xs text-slate-500 uppercase mb-2">AI Reassessment</div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-bold ${decisionColor(reassessment.previous_decision)}`}>
                    {decisionLabel(reassessment.previous_decision)}
                  </div>
                  <span className="text-slate-500 text-sm">→</span>
                  <div className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-bold ${decisionColor(reassessment.new_decision)}`}>
                    {decisionLabel(reassessment.new_decision)}
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{reassessment.reasoning}</p>
                {reassessment.threshold_breached && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                    <span className="rounded bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 font-bold">THRESHOLD BREACHED</span>
                  </div>
                )}
              </div>

              <button
                onClick={onReassess}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Re-run Reassessment
              </button>
            </div>
          )}
        </div>
      )}

      {!simulation && (
        <div className="text-center py-6 text-sm text-slate-500">
          Click a rollout button above to simulate production metrics and trigger the AI feedback loop.
        </div>
      )}
    </div>
  );
}
