import type { SimilarIncident } from '@/types';
import { riskTextColor } from '@/lib/ui';

interface Props {
  incidents: SimilarIncident[];
}

function severityBadge(severity: number): string {
  if (severity >= 5) return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (severity >= 4) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
  if (severity >= 3) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
}

export function HistoricalIncidents({ incidents }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Historical Incident Similarity</h2>
      <p className="text-xs text-slate-500 mb-3">TF-IDF + cosine similarity against 20 historical incidents</p>

      <div className="space-y-3">
        {incidents.map((si, idx) => (
          <div key={si.incident.incident_id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3 hover:border-slate-600 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${severityBadge(si.incident.severity)}`}>
                  {idx + 1}
                </span>
                <span className="text-sm font-mono font-semibold text-slate-200">{si.incident.incident_id}</span>
                <span className={`text-xs font-bold ${riskTextColor(si.similarity)}`}>{si.similarity}% similar</span>
              </div>
              <div className="flex gap-1">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${severityBadge(si.incident.severity)}`}>
                  SEV {si.incident.severity}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-1">{si.incident.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Module: </span>
                <span className="text-slate-300">{si.incident.affected_module}</span>
              </div>
              <div>
                <span className="text-slate-500">Release: </span>
                <span className="text-slate-300 font-mono">{si.incident.release_id}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Root cause: </span>
                <span className="text-slate-400">{si.incident.root_cause}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Affected users: </span>
                <span className="text-slate-400">{si.incident.affected_users.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-4">No similar incidents found.</div>
        )}
      </div>
    </div>
  );
}
