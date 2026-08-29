import React, { useState } from 'react';
import type { AnalysisResult, SuspiciousEvidence } from '@/types';
import { decisionColor, decisionLabel, severityColor } from '@/lib/ui';
import {
  Brain,
  AlertTriangle,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  ListChecks,
  FileSearch,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

interface Props {
  analysis: AnalysisResult;
}

export function Recommendation({ analysis }: Props) {
  const [showEvidence, setShowEvidence] = useState(true);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  const toggleAction = (idx: number) => {
    setCheckedActions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Derive explicit prescriptive release actions based on decision and risk score
  const getActionDirectives = () => {
    switch (analysis.decision) {
      case 'HOLD':
      case 'ROLLBACK_PREPARATION':
        return {
          title: '⛔ REJECT & BLOCK RELEASE PIPELINE',
          badgeText: 'MANDATORY BLOCK',
          bgClass: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
          recommendationText:
            'Do NOT promote this release to production. Automated analysis detected critical failure signals and defect propagation risk across mission-critical services.',
          checklist: [
            'Fix all failing unit and integration tests before re-queuing.',
            'Isolate and remediate high-risk database or core service schema changes.',
            'Prepare and verify automated rollback triggers in staging environment.',
            'Request formal architecture review and explicit sign-off from Release Lead.',
          ],
        };
      case 'STAGED_RELEASE':
        return {
          title: `⚠️ PROCEED WITH STAGED CANARY (${analysis.recommended_rollout}%)`,
          badgeText: 'CONTROLLED CANARY',
          bgClass: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
          recommendationText: `Permitted for phased canary deployment capped at ${analysis.recommended_rollout}% initial production traffic with a mandatory 15-minute telemetry observation window.`,
          checklist: [
            `Deploy canary pod routing strictly ${analysis.recommended_rollout}% user traffic.`,
            'Monitor Datadog/Sentry error rate thresholds (tripwire: >0.5% errors).',
            'Verify downstream service latency on affected microservices.',
            'Promote to 100% traffic only after 30 minutes of green telemetry.',
          ],
        };
      case 'RELEASE':
      default:
        return {
          title: '✅ APPROVED: DIRECT PRODUCTION ROLLOUT',
          badgeText: 'GREENLIGHT',
          bgClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
          recommendationText:
            'Risk metrics and test suites are within nominal tolerances. Safe to execute automated deployment pipeline directly to all production regions.',
          checklist: [
            'Execute standard continuous delivery deployment pipeline.',
            'Verify health check endpoints across all regions post-deployment.',
            'Confirm automated smoke tests pass in production.',
          ],
        };
    }
  };

  const action = getActionDirectives();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-6 shadow-xl">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-cyan-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            AI Recommended Release Action
          </h2>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
          Risk Score: {analysis.overall_risk}%
        </span>
      </div>

      {/* Action Directive Card */}
      <div className={`rounded-xl border p-4.5 space-y-3 ${action.bgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {analysis.decision === 'HOLD' || analysis.decision === 'ROLLBACK_PREPARATION' ? (
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            ) : analysis.decision === 'STAGED_RELEASE' ? (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            )}
            <span className="font-extrabold text-sm tracking-tight">{action.title}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-white/10">
            {action.badgeText}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-slate-200">{action.recommendationText}</p>

        {/* Deployment Strategy Specs */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
          <div className="bg-black/30 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 uppercase block">Strategy Protocol</span>
            <span className="font-mono font-bold text-white">{decisionLabel(analysis.decision)}</span>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 uppercase block">Initial Traffic Cap</span>
            <span className="font-mono font-bold text-cyan-300">{analysis.recommended_rollout}%</span>
          </div>
        </div>
      </div>

      {/* Agent Reasoning */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-1.5">
        <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          Autonomous Synthesis & Agent Reasoning
        </span>
        <p className="text-xs text-slate-300 leading-relaxed">{analysis.reasoning}</p>
      </div>

      {/* Suspicious Evidence & Root Causes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <FileSearch className="h-3.5 w-3.5 text-purple-400" />
            Detected Evidence & Risk Signals ({analysis.suspicious_evidence.length})
          </span>
          <span className="text-[11px] text-slate-500">Audit Proof</span>
        </div>

        {analysis.suspicious_evidence.length > 0 ? (
          <div className="space-y-2">
            {analysis.suspicious_evidence.map((e: SuspiciousEvidence, i) => (
              <div
                key={e.id || i}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
              >
                <span className="font-mono font-bold text-slate-500 text-[11px] mt-0.5">{i + 1}.</span>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-extrabold uppercase border ${severityColor(
                        e.severity,
                      )}`}
                    >
                      {e.severity}
                    </span>
                    <span className="font-semibold text-slate-200">{e.label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            No critical anomalies or suspicious defect patterns detected.
          </div>
        )}
      </div>

      {/* Actionable Remediation Checklist */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-emerald-400" />
          Pre-Flight Action Checklist
        </span>

        <div className="space-y-2">
          {action.checklist.map((item, idx) => {
            const isDone = !!checkedActions[idx];
            return (
              <div
                key={idx}
                onClick={() => toggleAction(idx)}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-xs select-none ${
                  isDone
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 line-through opacity-75'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div
                  className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                    isDone
                      ? 'bg-emerald-500 border-emerald-400 text-white'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {isDone && <CheckCircle2 className="h-3 w-3" />}
                </div>
                <span>{item}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable ML Notes */}
      <div className="pt-2 border-t border-slate-800/80">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center justify-between w-full text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {showEvidence ? 'Hide Technical ML Breakdown' : 'View Technical ML Component Breakdown'}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showEvidence ? 'rotate-180' : ''}`} />
        </button>

        {showEvidence && (
          <div className="mt-3 space-y-2">
            {analysis.ml_notes.map((n, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                <span className="font-bold text-cyan-300">{n.component}: </span>
                <span className="text-slate-400">{n.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
