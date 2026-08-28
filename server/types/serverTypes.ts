import type { ReleaseManifest, AnalysisResult, RolloutSimulation, Reassessment, FileProblem, FileMLAnalysisResult } from '../../src/types/index.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  timestamp: string;
}

export interface StoredReleaseEntity {
  id: string;
  release_id: string;
  created_at: string;
  overall_risk: number;
  decision: string;
  manifest: ReleaseManifest;
  analysis: AnalysisResult;
  simulation?: RolloutSimulation | null;
  reassessment?: Reassessment | null;
  notes?: string | null;
  source: string;
}

export interface StoredCorrectionEntity {
  id: string;
  release_id: string;
  created_at: string;
  original_snippet: string;
  corrected_manifest: ReleaseManifest;
  problems_found: number;
  corrections_count: number;
  source: 'gemini' | 'fallback';
}

export interface ServerDatabaseSchema {
  releases: StoredReleaseEntity[];
  corrections: StoredCorrectionEntity[];
  config: {
    version: string;
    initialized_at: string;
  };
}

export interface DetectProblemsRequest {
  content: string;
  fileName?: string;
}

export interface CorrectManifestRequest {
  rawJson: string;
  apiKey?: string;
  detectedProblems?: FileProblem[];
}

export interface AnalyzeReleaseRequest {
  manifest: ReleaseManifest;
  autoSave?: boolean;
  notes?: string;
}

export interface SimulateRolloutRequest {
  manifest: ReleaseManifest;
  analysis: AnalysisResult;
  percentage: number;
}
