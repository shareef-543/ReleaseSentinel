import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { StoredAnalysisRecord, StoredCorrectionRecord, ReleaseDecision } from '@/types';
import {
  getAnalysisRecords,
  deleteAnalysisRecord,
  getCorrectionRecords,
  deleteCorrectionRecord,
  exportAllDataAsJson,
  importDataFromJson,
  getBackendConfig,
} from '@/lib/backend/db';
import {
  Database,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Shield,
  Layers,
  ArrowUpDown,
  X,
} from 'lucide-react';

interface BackendHistoryProps {
  onLoadRelease: (record: StoredAnalysisRecord) => void;
  onNavigateToDashboard: () => void;
}

export function BackendHistory({ onLoadRelease, onNavigateToDashboard }: BackendHistoryProps) {
  const [activeTab, setActiveTab] = useState<'analyses' | 'corrections'>('analyses');
  const [analyses, setAnalyses] = useState<StoredAnalysisRecord[]>([]);
  const [corrections, setCorrections] = useState<StoredCorrectionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<StoredAnalysisRecord | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const config = getBackendConfig();

  const loadData = async () => {
    setLoading(true);
    try {
      const [analysesData, correctionsData] = await Promise.all([
        getAnalysisRecords(),
        getCorrectionRecords(),
      ]);
      setAnalyses(analysesData);
      setCorrections(correctionsData);
    } catch (err) {
      console.error('Failed to load history data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this release record?')) {
      await deleteAnalysisRecord(id);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
    }
  };

  const handleDeleteCorrection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this AI correction log?')) {
      await deleteCorrectionRecord(id);
      setCorrections((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleExportData = () => {
    const jsonStr = exportAllDataAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `releasesentinel-database-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      const res = await importDataFromJson(text);
      if (res.success) {
        setImportStatus(`Successfully imported ${res.count} record(s)!`);
        loadData();
      } else {
        setImportStatus(`Import failed: ${res.error}`);
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  const filteredAnalyses = useMemo(() => {
    return analyses.filter((rec) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        rec.release_id.toLowerCase().includes(q) ||
        rec.manifest.changed_modules.some((m) => m.toLowerCase().includes(q)) ||
        (rec.notes && rec.notes.toLowerCase().includes(q));

      const matchesDecision = decisionFilter === 'ALL' || rec.decision === decisionFilter;

      let matchesRisk = true;
      if (riskFilter === 'low') matchesRisk = rec.overall_risk < 35;
      else if (riskFilter === 'medium') matchesRisk = rec.overall_risk >= 35 && rec.overall_risk < 65;
      else if (riskFilter === 'high') matchesRisk = rec.overall_risk >= 65 && rec.overall_risk < 80;
      else if (riskFilter === 'critical') matchesRisk = rec.overall_risk >= 80;

      return matchesSearch && matchesDecision && matchesRisk;
    });
  }, [analyses, searchQuery, decisionFilter, riskFilter]);

  const decisionBadgeClass = (decision: ReleaseDecision) => {
    switch (decision) {
      case 'RELEASE':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'STAGED_RELEASE':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'HOLD':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'ROLLBACK_PREPARATION':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
  };

  const riskBadgeClass = (risk: number) => {
    if (risk >= 80) return 'text-rose-400 bg-rose-950/40 border-rose-500/30';
    if (risk >= 60) return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
    if (risk >= 35) return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30';
    return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header & Storage Status */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Database className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold text-white">Backend Storage & Release History</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Persistent storage repository for release risk analyses, simulation records, and AI data correction logs.
              Synchronized with {config.supabaseUrl ? 'Supabase PostgreSQL Cloud Backend' : 'Local Persistent Engine (IndexedDB)'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportData}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-all"
            >
              <Download className="h-3.5 w-3.5" /> Export DB JSON
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-all"
            >
              <Upload className="h-3.5 w-3.5" /> Import Backup
            </button>
            <input ref={importFileRef} type="file" accept=".json" onChange={handleImportData} className="hidden" />

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {importStatus && (
          <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-2.5 text-xs text-cyan-300">
            {importStatus}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('analyses')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'analyses'
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="h-4 w-4" /> Release Analyses ({analyses.length})
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'corrections'
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="h-4 w-4" /> AI Manifest Corrections ({corrections.length})
        </button>
      </div>

      {/* ANALYSES TAB */}
      {activeTab === 'analyses' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Release ID or Module name..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Decisions</option>
                <option value="RELEASE">RELEASE</option>
                <option value="STAGED_RELEASE">STAGED_RELEASE</option>
                <option value="HOLD">HOLD</option>
                <option value="ROLLBACK_PREPARATION">ROLLBACK_PREPARATION</option>
              </select>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="low">Low (0-34)</option>
                <option value="medium">Medium (35-64)</option>
                <option value="high">High (65-79)</option>
                <option value="critical">Critical (80-100)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredAnalyses.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
              {analyses.length === 0
                ? 'No release analyses saved in backend yet. Run an analysis from the Sentinel Dashboard to populate history.'
                : 'No saved releases match the selected filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Release ID</th>
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Overall Risk</th>
                    <th className="px-4 py-3 font-semibold">Agent Decision</th>
                    <th className="px-4 py-3 font-semibold">Modules</th>
                    <th className="px-4 py-3 font-semibold">Simulation Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredAnalyses.map((rec) => (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-white font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-400 font-mono">{rec.release_id}</span>
                          {rec.source === 'ai_corrected' && (
                            <span className="rounded bg-purple-500/20 px-1 py-0.2 text-[9px] text-purple-300 font-sans">
                              AI Corrected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(rec.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 font-bold ${riskBadgeClass(rec.overall_risk)}`}>
                          {rec.overall_risk}/100
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${decisionBadgeClass(rec.decision)}`}>
                          {rec.decision}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-xs truncate font-sans">
                        {rec.manifest.changed_modules.join(', ')}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {rec.simulation ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] ${
                              rec.simulation.status === 'ok'
                                ? 'text-emerald-400'
                                : rec.simulation.status === 'warning'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {rec.simulation.percentage}% Sim ({rec.simulation.error_rate.toFixed(1)}% err)
                          </span>
                        ) : (
                          <span className="text-slate-500">Not Simulated</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onLoadRelease(rec);
                              onNavigateToDashboard();
                            }}
                            title="Load into Sentinel Dashboard"
                            className="rounded p-1.5 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteAnalysis(rec.id, e)}
                            title="Delete Record"
                            className="rounded p-1.5 text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CORRECTIONS TAB */}
      {activeTab === 'corrections' && (
        <div className="space-y-4">
          {corrections.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
              No AI manifest auto-healing logs recorded yet. Use the ML Diagnostic & AI Healing Studio to test corrections.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {corrections.map((corr) => (
                <div key={corr.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-purple-400" />
                      <span className="font-bold text-white text-xs font-mono">{corr.release_id}</span>
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] text-purple-300 font-sans uppercase">
                        {corr.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(corr.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <button
                        onClick={(e) => handleDeleteCorrection(corr.id, e)}
                        className="rounded p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
                      <span className="text-slate-500">Problems Diagnosed: </span>
                      <span className="text-amber-400 font-bold">{corr.problems_found}</span>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
                      <span className="text-slate-500">Corrections Applied: </span>
                      <span className="text-emerald-400 font-bold">{corr.corrections_count}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Corrected Output</div>
                    <pre className="max-h-28 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 text-[10px] font-mono text-emerald-300">
                      {JSON.stringify(corr.corrected_manifest, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL DRAWER */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white font-mono">{selectedRecord.release_id}</h3>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${decisionBadgeClass(selectedRecord.decision)}`}>
                    {selectedRecord.decision}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Saved on {new Date(selectedRecord.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Risk Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              <div className="rounded-lg bg-slate-950 p-2.5 text-center border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Overall Risk</div>
                <div className={`text-lg font-bold font-mono ${selectedRecord.overall_risk >= 65 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedRecord.overall_risk}/100
                </div>
              </div>
              <div className="rounded-lg bg-slate-950 p-2.5 text-center border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Code Risk</div>
                <div className="text-lg font-bold font-mono text-slate-200">
                  {selectedRecord.analysis.risk_components.code_change_risk}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950 p-2.5 text-center border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Test Risk</div>
                <div className="text-lg font-bold font-mono text-slate-200">
                  {selectedRecord.analysis.risk_components.test_risk}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950 p-2.5 text-center border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Propagation</div>
                <div className="text-lg font-bold font-mono text-slate-200">
                  {selectedRecord.analysis.risk_components.propagation_risk}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950 p-2.5 text-center border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Production Impact</div>
                <div className="text-lg font-bold font-mono text-slate-200">
                  {selectedRecord.analysis.risk_components.production_impact}
                </div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="rounded-lg bg-slate-950/80 p-3.5 border border-slate-800 mb-4">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">Decision Reasoning:</div>
              <p className="text-xs text-slate-400 leading-relaxed">{selectedRecord.analysis.reasoning}</p>
            </div>

            {/* Manifest Details */}
            <div className="space-y-2 text-xs mb-6">
              <div className="text-xs font-semibold text-slate-300">Manifest Contents:</div>
              <pre className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] font-mono text-slate-300">
                {JSON.stringify(selectedRecord.manifest, null, 2)}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onLoadRelease(selectedRecord);
                  setSelectedRecord(null);
                  onNavigateToDashboard();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2 text-xs font-bold text-white hover:from-blue-500 hover:to-cyan-500"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Load into Active Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
