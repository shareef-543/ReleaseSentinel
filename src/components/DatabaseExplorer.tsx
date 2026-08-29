import React, { useState, useEffect, useCallback } from 'react';
import { inbuiltDb, type AuditLogEntry } from '@/lib/backend/inbuiltDb';
import type { StoredAnalysisRecord, StoredCorrectionRecord } from '@/types';
import {
  Database,
  HardDrive,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  FileCode,
  Sparkles,
  Users,
  Clock,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface Props {
  onNotification: (type: 'success' | 'error', text: string) => void;
}

export function DatabaseExplorer({ onNotification }: Props) {
  const [selectedDbTable, setSelectedDbTable] = useState<'releases' | 'corrections' | 'audit_logs'>('releases');
  const [storedReleases, setStoredReleases] = useState<StoredAnalysisRecord[]>([]);
  const [storedCorrections, setStoredCorrections] = useState<StoredCorrectionRecord[]>([]);
  const [storedAuditLogs, setStoredAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedRecordJson, setSelectedRecordJson] = useState<any | null>(null);
  const [dbStats, setDbStats] = useState(inbuiltDb.getStats());

  const loadData = useCallback(async () => {
    // 1. Releases
    try {
      const res = await fetch(`${API_BASE}/api/v1/releases`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStoredReleases(data.data);
      } else {
        setStoredReleases(inbuiltDb.releases.getAll());
      }
    } catch {
      setStoredReleases(inbuiltDb.releases.getAll());
    }

    // 2. Corrections
    try {
      const res = await fetch(`${API_BASE}/api/v1/corrections`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStoredCorrections(data.data);
      } else {
        setStoredCorrections(inbuiltDb.corrections.getAll());
      }
    } catch {
      setStoredCorrections(inbuiltDb.corrections.getAll());
    }

    // 3. Audit logs
    setStoredAuditLogs(inbuiltDb.auditLogs.getAll());
    setDbStats(inbuiltDb.getStats());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadBackup = () => {
    const backupJson = inbuiltDb.exportBackupJSON();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `releasesentinel_db_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotification('success', 'Database backup downloaded successfully');
  };

  const handlePurgeTable = (tableName: 'releases' | 'corrections') => {
    if (!confirm(`Are you sure you want to purge all records in "${tableName}" table?`)) return;
    if (tableName === 'releases') {
      inbuiltDb.releases.clear();
    } else {
      inbuiltDb.corrections.clear();
    }
    loadData();
    onNotification('success', `Purged ${tableName} table`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Storage Architecture Info */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Live System Database Engine
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  ACTIVE & PERSISTED
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Storage File: <span className="text-cyan-300">server/data/db.json</span> & Browser Inbuilt LocalDB ({Math.max(1, Math.round(dbStats.databaseSizeBytes / 1024))} KB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Table Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-semibold mr-1">Select Table:</span>
          <button
            onClick={() => setSelectedDbTable('releases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedDbTable === 'releases'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            📊 releases ({storedReleases.length})
          </button>

          <button
            onClick={() => setSelectedDbTable('corrections')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedDbTable === 'corrections'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🪄 corrections ({storedCorrections.length})
          </button>

          <button
            onClick={() => setSelectedDbTable('audit_logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedDbTable === 'audit_logs'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            📋 audit_logs ({storedAuditLogs.length})
          </button>
        </div>
      </div>

      {/* Table 1: Releases */}
      {selectedDbTable === 'releases' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-400" />
              <span>Table: `releases` ({storedReleases.length} records)</span>
            </div>
            {storedReleases.length > 0 && (
              <button
                onClick={() => handlePurgeTable('releases')}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Purge Table
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3">ID / Release</th>
                  <th className="p-3">Decision</th>
                  <th className="p-3">Risk Score</th>
                  <th className="p-3">Changed Files</th>
                  <th className="p-3">Modules</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {storedReleases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No release records stored yet. Run an analysis on the Risk Pipeline tab to auto-save!
                    </td>
                  </tr>
                ) : (
                  storedReleases.map((rel) => (
                    <tr key={rel.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-cyan-300 font-bold">{rel.release_id || rel.id}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rel.decision === 'RELEASE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : rel.decision === 'STAGED_RELEASE'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {rel.decision}
                        </span>
                      </td>
                      <td className="p-3 text-slate-200">{rel.overall_risk}%</td>
                      <td className="p-3 text-slate-400">{rel.manifest?.changed_files?.length || 0} files</td>
                      <td className="p-3 text-slate-400">
                        {rel.manifest?.changed_modules?.join(', ') || 'N/A'}
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {new Date(rel.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedRecordJson(rel)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition-all text-[11px] font-sans font-bold flex items-center gap-1 ml-auto"
                        >
                          <Eye className="h-3 w-3" />
                          JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table 2: Corrections */}
      {selectedDbTable === 'corrections' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span>Table: `corrections` ({storedCorrections.length} records)</span>
            </div>
            {storedCorrections.length > 0 && (
              <button
                onClick={() => handlePurgeTable('corrections')}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Purge Table
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Release Target</th>
                  <th className="p-3">Problems Fixed</th>
                  <th className="p-3">Engine Source</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {storedCorrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No code correction logs stored yet. Use the Code Corrector to heal bugs!
                    </td>
                  </tr>
                ) : (
                  storedCorrections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-pink-300 font-bold">{c.id}</td>
                      <td className="p-3 text-slate-300">{c.release_id}</td>
                      <td className="p-3 text-emerald-400 font-bold">{c.problems_found} bug(s) fixed</td>
                      <td className="p-3 text-slate-400 uppercase text-[10px]">{c.source}</td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedRecordJson(c)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-pink-600 text-slate-300 hover:text-white transition-all text-[11px] font-sans font-bold flex items-center gap-1 ml-auto"
                        >
                          <Eye className="h-3 w-3" />
                          JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table 3: Audit Logs */}
      {selectedDbTable === 'audit_logs' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Table: `audit_logs` ({storedAuditLogs.length} events)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Details</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {storedAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-slate-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 text-amber-300 font-bold">{log.action}</td>
                    <td className="p-3 text-slate-300">{log.user_email || 'system'}</td>
                    <td className="p-3 text-slate-400 truncate max-w-xs">{JSON.stringify(log.details)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedRecordJson(log)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white transition-all text-[11px] font-sans font-bold flex items-center gap-1 ml-auto"
                      >
                        <Eye className="h-3 w-3" />
                        JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD JSON INSPECTOR MODAL */}
      {selectedRecordJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Database Record Inspector (JSON)
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordJson(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <pre className="max-h-96 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-cyan-300 leading-relaxed">
              {JSON.stringify(selectedRecordJson, null, 2)}
            </pre>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedRecordJson, null, 2));
                  onNotification('success', 'JSON copied to clipboard');
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setSelectedRecordJson(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
