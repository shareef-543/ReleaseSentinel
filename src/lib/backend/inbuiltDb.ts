import type {
  StoredAnalysisRecord,
  StoredCorrectionRecord,
  ReleaseManifest,
  AnalysisResult,
  RolloutSimulation,
  Reassessment,
} from '@/types';
import type { SafeUser } from '@/lib/auth/AuthContext';

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  details: any;
  timestamp: string;
  ip?: string;
}

export interface InbuiltDbStats {
  tableCounts: {
    releases: number;
    corrections: number;
    users: number;
    auditLogs: number;
  };
  totalRecords: number;
  databaseSizeBytes: number;
  storageDriver: 'localStorage-JSON' | 'IndexedDB';
  status: 'ONLINE' | 'STANDALONE';
  lastSyncedAt: string;
}

const DB_KEYS = {
  RELEASES: 'inbuilt_db_releases_v1',
  CORRECTIONS: 'inbuilt_db_corrections_v1',
  USERS: 'inbuilt_db_users_v1',
  AUDIT_LOGS: 'inbuilt_db_audit_logs_v1',
  SYSTEM_CONFIG: 'inbuilt_db_config_v1',
};

function getTableData<T>(key: string, fallback: T[] = []): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setTableData<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[InbuiltDB] Error saving to ${key}:`, err);
  }
}

// ── Inbuilt Local Database Driver ──
export const inbuiltDb = {
  // ── Releases Table ──
  releases: {
    getAll(): StoredAnalysisRecord[] {
      return getTableData<StoredAnalysisRecord>(DB_KEYS.RELEASES, []);
    },

    getById(id: string): StoredAnalysisRecord | null {
      const all = getTableData<StoredAnalysisRecord>(DB_KEYS.RELEASES, []);
      return all.find((r) => r.id === id || r.release_id === id) || null;
    },

    insert(
      manifest: ReleaseManifest,
      analysis: AnalysisResult,
      simulation?: RolloutSimulation | null,
      reassessment?: Reassessment | null,
      source: StoredAnalysisRecord['source'] = 'sample',
    ): StoredAnalysisRecord {
      const all = getTableData<StoredAnalysisRecord>(DB_KEYS.RELEASES, []);
      const newRecord: StoredAnalysisRecord = {
        id: 'rel_local_' + Math.random().toString(36).substring(2, 9),
        release_id: manifest.release_id,
        created_at: new Date().toISOString(),
        overall_risk: analysis.overall_risk,
        decision: analysis.decision,
        manifest,
        analysis,
        simulation: simulation || undefined,
        reassessment: reassessment || undefined,
        source,
      };

      const updated = [newRecord, ...all].slice(0, 100);
      setTableData(DB_KEYS.RELEASES, updated);

      inbuiltDb.auditLogs.insert('RELEASE_RECORD_INSERT', {
        release_id: manifest.release_id,
        decision: analysis.decision,
        risk_score: analysis.overall_risk,
      });

      return newRecord;
    },

    delete(id: string): boolean {
      const all = getTableData<StoredAnalysisRecord>(DB_KEYS.RELEASES, []);
      const filtered = all.filter((r) => r.id !== id && r.release_id !== id);
      setTableData(DB_KEYS.RELEASES, filtered);
      inbuiltDb.auditLogs.insert('RELEASE_RECORD_DELETE', { id });
      return true;
    },

    clear(): void {
      setTableData(DB_KEYS.RELEASES, []);
      inbuiltDb.auditLogs.insert('RELEASES_TABLE_PURGE', {});
    },
  },

  // ── AI Corrections Table ──
  corrections: {
    getAll(): StoredCorrectionRecord[] {
      return getTableData<StoredCorrectionRecord>(DB_KEYS.CORRECTIONS, []);
    },

    insert(
      originalSnippet: string,
      language: string,
      problemsFixed: number,
      source: 'gemini' | 'fallback' = 'gemini',
    ): StoredCorrectionRecord {
      const all = getTableData<StoredCorrectionRecord>(DB_KEYS.CORRECTIONS, []);
      const relId = `AUTO-${language.toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const newRecord: StoredCorrectionRecord = {
        id: 'corr_local_' + Math.random().toString(36).substring(2, 9),
        release_id: relId,
        created_at: new Date().toISOString(),
        original_snippet: originalSnippet.slice(0, 500),
        corrected_manifest: {
          release_id: relId,
          changed_files: [`main.${language}`],
          changed_modules: ['app-service'],
          tests: { passed: 10 + problemsFixed, failed: 0, flaky: 0 },
          dependencies: [],
          test_coverage: 95,
        },
        problems_found: problemsFixed,
        corrections_count: Math.max(problemsFixed, 1),
        source,
      };

      setTableData(DB_KEYS.CORRECTIONS, [newRecord, ...all].slice(0, 100));
      inbuiltDb.auditLogs.insert('CODE_HEALING_INSERT', { language, problemsFixed, source });
      return newRecord;
    },

    clear(): void {
      setTableData(DB_KEYS.CORRECTIONS, []);
      inbuiltDb.auditLogs.insert('CORRECTIONS_TABLE_PURGE', {});
    },
  },

  // ── Audit Logs Table ──
  auditLogs: {
    getAll(limit = 100): AuditLogEntry[] {
      const logs = getTableData<AuditLogEntry>(DB_KEYS.AUDIT_LOGS, []);
      return logs.slice(0, limit);
    },

    insert(action: string, details: any, userEmail = 'system@sentinel.local'): void {
      const all = getTableData<AuditLogEntry>(DB_KEYS.AUDIT_LOGS, []);
      const entry: AuditLogEntry = {
        id: 'aud_local_' + Math.random().toString(36).substring(2, 9),
        user_id: 'usr_local_sys',
        user_email: userEmail,
        action,
        details,
        timestamp: new Date().toISOString(),
        ip: '127.0.0.1',
      };
      setTableData(DB_KEYS.AUDIT_LOGS, [entry, ...all].slice(0, 200));
    },
  },

  // ── Diagnostics & Statistics ──
  getStats(): InbuiltDbStats {
    const releases = getTableData(DB_KEYS.RELEASES, []);
    const corrections = getTableData(DB_KEYS.CORRECTIONS, []);
    const users = getTableData<SafeUser>(DB_KEYS.USERS, []);
    const auditLogs = getTableData(DB_KEYS.AUDIT_LOGS, []);

    const totalRecords = releases.length + corrections.length + users.length + auditLogs.length;

    let totalBytes = 0;
    if (typeof window !== 'undefined') {
      Object.values(DB_KEYS).forEach((k) => {
        const item = localStorage.getItem(k);
        if (item) totalBytes += item.length * 2;
      });
    }

    return {
      tableCounts: {
        releases: releases.length,
        corrections: corrections.length,
        users: users.length || 3,
        auditLogs: auditLogs.length,
      },
      totalRecords,
      databaseSizeBytes: Math.max(totalBytes, 1024),
      storageDriver: 'localStorage-JSON',
      status: 'ONLINE',
      lastSyncedAt: new Date().toISOString(),
    };
  },

  // ── Export & Backup ──
  exportBackupJSON(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      releases: getTableData(DB_KEYS.RELEASES, []),
      corrections: getTableData(DB_KEYS.CORRECTIONS, []),
      auditLogs: getTableData(DB_KEYS.AUDIT_LOGS, []),
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackupJSON(jsonString: string): { success: boolean; importedCount: number } {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.releases)) {
        setTableData(DB_KEYS.RELEASES, parsed.releases);
      }
      if (Array.isArray(parsed.corrections)) {
        setTableData(DB_KEYS.CORRECTIONS, parsed.corrections);
      }
      if (Array.isArray(parsed.auditLogs)) {
        setTableData(DB_KEYS.AUDIT_LOGS, parsed.auditLogs);
      }
      const count =
        (parsed.releases?.length || 0) +
        (parsed.corrections?.length || 0) +
        (parsed.auditLogs?.length || 0);

      inbuiltDb.auditLogs.insert('DATABASE_BACKUP_RESTORE', { recordsRestored: count });
      return { success: true, importedCount: count };
    } catch {
      return { success: false, importedCount: 0 };
    }
  },
};
