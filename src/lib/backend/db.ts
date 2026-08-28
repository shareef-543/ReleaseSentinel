import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  StoredAnalysisRecord,
  StoredCorrectionRecord,
  BackendConfig,
  AnalysisResult,
  ReleaseManifest,
  RolloutSimulation,
  Reassessment,
} from '@/types';

const STORAGE_KEYS = {
  CONFIG: 'release_sentinel_backend_config',
  ANALYSES: 'release_sentinel_stored_analyses',
  CORRECTIONS: 'release_sentinel_stored_corrections',
};

const DEFAULT_CONFIG: BackendConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  autoSaveAnalyses: true,
  storageMode: 'local',
};

export function getBackendConfig(): BackendConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveBackendConfig(config: Partial<BackendConfig>): BackendConfig {
  const current = getBackendConfig();
  const updated = { ...current, ...config };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
    if (updated.geminiApiKey) {
      localStorage.setItem('release_sentinel_gemini_api_key', updated.geminiApiKey);
    }
  }
  return updated;
}

let supabaseInstance: SupabaseClient | null = null;
let lastSupabaseUrl = '';
let lastSupabaseKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getBackendConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  if (
    supabaseInstance &&
    lastSupabaseUrl === config.supabaseUrl &&
    lastSupabaseKey === config.supabaseAnonKey
  ) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(config.supabaseUrl, config.supabaseAnonKey);
    lastSupabaseUrl = config.supabaseUrl;
    lastSupabaseKey = config.supabaseAnonKey;
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(url?: string, key?: string): Promise<{ ok: boolean; message: string }> {
  const config = getBackendConfig();
  const testUrl = url || config.supabaseUrl;
  const testKey = key || config.supabaseAnonKey;

  if (!testUrl || !testKey) {
    return { ok: false, message: 'Please provide both Supabase URL and Anon Key.' };
  }

  try {
    const client = createClient(testUrl, testKey);
    // Simple ping to verify network connectivity and auth headers
    const { error } = await client.from('release_analyses').select('id').limit(1);
    if (error && !error.message.includes('relation "public.release_analyses" does not exist')) {
      return { ok: false, message: `Connection error: ${error.message}` };
    }
    return {
      ok: true,
      message: error ? 'Connected to Supabase! Note: Table "release_analyses" will be created on first sync.' : 'Successfully connected to Supabase!',
    };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── Analysis Storage ──────────────────────────────────────────

export async function saveAnalysisRecord(
  manifest: ReleaseManifest,
  analysis: AnalysisResult,
  simulation?: RolloutSimulation,
  reassessment?: Reassessment,
  source: StoredAnalysisRecord['source'] = 'manual',
  notes?: string,
): Promise<StoredAnalysisRecord> {
  const record: StoredAnalysisRecord = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    release_id: manifest.release_id,
    created_at: new Date().toISOString(),
    overall_risk: analysis.overall_risk,
    decision: analysis.decision,
    manifest,
    analysis,
    simulation,
    reassessment,
    source,
    notes,
  };

  // 1. Save to local storage
  const localList = getLocalAnalyses();
  // Keep newest first, max 100 items
  const updated = [record, ...localList.filter((r) => r.id !== record.id)].slice(0, 100);
  setLocalAnalyses(updated);

  // 2. Sync to Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('release_analyses').upsert({
        id: record.id,
        release_id: record.release_id,
        created_at: record.created_at,
        overall_risk: record.overall_risk,
        decision: record.decision,
        manifest_data: record.manifest,
        analysis_data: record.analysis,
        simulation_data: record.simulation || null,
        reassessment_data: record.reassessment || null,
        source: record.source,
        notes: record.notes || null,
      });
    } catch (err) {
      console.warn('Could not sync analysis to Supabase (using local fallback):', err);
    }
  }

  return record;
}

export async function getAnalysisRecords(): Promise<StoredAnalysisRecord[]> {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('release_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          release_id: d.release_id,
          created_at: d.created_at,
          overall_risk: d.overall_risk,
          decision: d.decision,
          manifest: d.manifest_data,
          analysis: d.analysis_data,
          simulation: d.simulation_data,
          reassessment: d.reassessment_data,
          source: d.source || 'manual',
          notes: d.notes,
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch from Supabase, returning local store:', err);
    }
  }

  return getLocalAnalyses();
}

export async function deleteAnalysisRecord(id: string): Promise<boolean> {
  const localList = getLocalAnalyses();
  setLocalAnalyses(localList.filter((r) => r.id !== id));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('release_analyses').delete().eq('id', id);
    } catch (err) {
      console.warn('Failed to delete record from Supabase:', err);
    }
  }

  return true;
}

// ── Correction Storage ────────────────────────────────────────

export async function saveCorrectionRecord(
  manifest: ReleaseManifest,
  originalSnippet: string,
  problemsFound: number,
  correctionsCount: number,
  source: 'gemini' | 'fallback',
): Promise<StoredCorrectionRecord> {
  const record: StoredCorrectionRecord = {
    id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    release_id: manifest.release_id,
    created_at: new Date().toISOString(),
    original_snippet: originalSnippet.slice(0, 1500),
    corrected_manifest: manifest,
    problems_found: problemsFound,
    corrections_count: correctionsCount,
    source,
  };

  const list = getLocalCorrections();
  setLocalCorrections([record, ...list].slice(0, 50));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('manifest_corrections').upsert({
        id: record.id,
        release_id: record.release_id,
        created_at: record.created_at,
        original_snippet: record.original_snippet,
        corrected_manifest: record.corrected_manifest,
        problems_found: record.problems_found,
        corrections_count: record.corrections_count,
        source: record.source,
      });
    } catch (err) {
      console.warn('Could not sync correction to Supabase:', err);
    }
  }

  return record;
}

export async function getCorrectionRecords(): Promise<StoredCorrectionRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('manifest_corrections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return data as StoredCorrectionRecord[];
      }
    } catch (err) {
      console.warn('Failed to fetch corrections from Supabase:', err);
    }
  }
  return getLocalCorrections();
}

export async function deleteCorrectionRecord(id: string): Promise<boolean> {
  const list = getLocalCorrections();
  setLocalCorrections(list.filter((c) => c.id !== id));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('manifest_corrections').delete().eq('id', id);
    } catch (err) {
      console.warn('Failed to delete correction from Supabase:', err);
    }
  }
  return true;
}

// ── Export & Import Utilities ─────────────────────────────────

export function exportAllDataAsJson(): string {
  const payload = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    analyses: getLocalAnalyses(),
    corrections: getLocalCorrections(),
  };
  return JSON.stringify(payload, null, 2);
}

export async function importDataFromJson(jsonStr: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const data = JSON.parse(jsonStr);
    let count = 0;

    if (Array.isArray(data.analyses)) {
      const existing = getLocalAnalyses();
      const merged = [...data.analyses, ...existing];
      // Deduplicate by ID
      const unique = Array.from(new Map(merged.map((m) => [m.id, m])).values());
      setLocalAnalyses(unique.slice(0, 100));
      count += data.analyses.length;
    }

    if (Array.isArray(data.corrections)) {
      const existing = getLocalCorrections();
      const merged = [...data.corrections, ...existing];
      const unique = Array.from(new Map(merged.map((m) => [m.id, m])).values());
      setLocalCorrections(unique.slice(0, 50));
      count += data.corrections.length;
    }

    return { success: true, count };
  } catch (err) {
    return { success: false, count: 0, error: err instanceof Error ? err.message : 'Invalid JSON file format' };
  }
}

// ── Internal LocalStorage Helpers ─────────────────────────────

function getLocalAnalyses(): StoredAnalysisRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANALYSES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalAnalyses(records: StoredAnalysisRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ANALYSES, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save analyses to localStorage:', err);
  }
}

function getLocalCorrections(): StoredCorrectionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CORRECTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCorrections(records: StoredCorrectionRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CORRECTIONS, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save corrections to localStorage:', err);
  }
}
