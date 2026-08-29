import type { ReleaseManifest, AnalysisResult, RolloutSimulation, Reassessment, FileProblem } from '../../src/types/index.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  timestamp: string;
}

export type UserRole = 'admin' | 'lead' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  last_login_at?: string | null;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuditLogEntity {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  details?: any;
  timestamp: string;
  ip?: string;
}

export interface SystemConfigEntity {
  geminiModel: string;
  maxStoredReleases: number;
  autoApprovalThreshold: number;
  maintenanceMode: boolean;
  updated_at: string;
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
  user_id?: string | null;
  user_email?: string | null;
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
  user_id?: string | null;
  user_email?: string | null;
}

export interface ServerDatabaseSchema {
  users: UserEntity[];
  releases: StoredReleaseEntity[];
  corrections: StoredCorrectionEntity[];
  auditLogs: AuditLogEntity[];
  systemConfig: SystemConfigEntity;
  config: {
    version: string;
    initialized_at: string;
  };
}

// Request & Response DTOs
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponseData {
  user: SafeUser;
  token: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
}

export interface AdminStatsResponse {
  total_users: number;
  active_users: number;
  total_releases: number;
  total_corrections: number;
  total_audit_logs: number;
  system_health: string;
  gemini_model: string;
  database_size_bytes: number;
  uptime_seconds: number;
}
