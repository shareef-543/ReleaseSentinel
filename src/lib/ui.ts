import type { ReleaseDecision, ModuleRisk } from '@/types';

export function decisionColor(decision: ReleaseDecision): string {
  switch (decision) {
    case 'RELEASE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'STAGED_RELEASE': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'HOLD': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'ROLLBACK_PREPARATION': return 'text-red-400 bg-red-500/10 border-red-500/30';
  }
}

export function decisionLabel(decision: ReleaseDecision): string {
  switch (decision) {
    case 'RELEASE': return 'RELEASE';
    case 'STAGED_RELEASE': return 'STAGED RELEASE';
    case 'HOLD': return 'HOLD';
    case 'ROLLBACK_PREPARATION': return 'ROLLBACK PREPARATION';
  }
}

export function riskColor(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 35) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function riskTextColor(score: number): string {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 35) return 'text-amber-400';
  return 'text-emerald-400';
}

export function riskBgColor(score: number): string {
  if (score >= 80) return 'bg-red-500/10';
  if (score >= 60) return 'bg-orange-500/10';
  if (score >= 35) return 'bg-amber-500/10';
  return 'bg-emerald-500/10';
}

export function moduleRiskIcon(level: ModuleRisk['level']): string {
  switch (level) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function statusColor(status: 'ok' | 'warning' | 'critical'): string {
  switch (status) {
    case 'ok': return 'text-emerald-400';
    case 'warning': return 'text-amber-400';
    case 'critical': return 'text-red-400';
  }
}

export function statusBg(status: 'ok' | 'warning' | 'critical'): string {
  switch (status) {
    case 'ok': return 'bg-emerald-500/10 border-emerald-500/30';
    case 'warning': return 'bg-amber-500/10 border-amber-500/30';
    case 'critical': return 'bg-red-500/10 border-red-500/30';
  }
}

export function statusLabel(status: 'ok' | 'warning' | 'critical'): string {
  switch (status) {
    case 'ok': return 'OK';
    case 'warning': return 'WARNING';
    case 'critical': return 'CRITICAL';
  }
}
