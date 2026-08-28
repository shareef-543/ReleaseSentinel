import type { AnalysisResult, SuspiciousEvidence } from '@/types';
import { decisionColor, decisionLabel, severityColor } from '@/lib/ui';
import { Brain, AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Props {
  analysis: AnalysisResult;
}

export function Recommendation({ analysis }: Props) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">AI Recommendation</h2>
      </div>

      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 mb-4 ${decisionColor(analysis.decision)}`}>
        <AlertTriangle className="h-6 w-6" />
        <div>
          <div className="text-lg font-bold">{decisionLabel(analysis.decision)}</div>
          {(analysis.decision === 'STAGED_RELEASE' || analysis.decision === 'ROLLBACK_PREPARATION') && (
            <div className="text-xs opacity-80">Recommended rollout: {analysis.recommended_rollout}%</div>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 mb-4">
        <div className="text-xs text-slate-500 uppercase mb-2">Agent Reasoning</div>
        <p className="text-sm text-slate-200 leading-relaxed">{analysis.reasoning}</p>
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase mb-2">Multi-Task Project Risk Model</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(analysis.project_risk).map(([label, prediction]) => (
            <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/30 p-2.5">
              <div className="text-[10px] text-slate-500 uppercase">{label.replace('_risk', '')}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-mono font-bold text-cyan-300">{Math.round(prediction.score * 100)}%</span>
                <span className="text-[10px] text-slate-400">{prediction.level}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk contributors */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase mb-2">Risk Contributors (Explainability)</div>
        <div className="space-y-1.5">
          {analysis.contributors.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                <span className="text-cyan-400 font-mono">+{c.delta}</span> {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Suspicious evidence */}
      {analysis.suspicious_evidence.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 uppercase mb-2">Suspicious Evidence Detected</div>
          <div className="space-y-1.5">
            {analysis.suspicious_evidence.map((e: SuspiciousEvidence, i) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">{i + 1}.</span>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${severityColor(e.severity)}`}>
                  {e.severity}
                </span>
                <span className="text-slate-300">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable evidence */}
      <button
        onClick={() => setShowEvidence(!showEvidence)}
        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showEvidence ? 'rotate-180' : ''}`} />
        {showEvidence ? 'Hide' : 'Show'} full evidence & ML notes
      </button>

      {showEvidence && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
            <div className="text-xs text-slate-500 uppercase mb-2">ML Component Notes</div>
            <div className="space-y-2">
              {analysis.ml_notes.map((n, i) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold text-slate-300">{n.component}: </span>
                  <span className="text-slate-400">{n.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
