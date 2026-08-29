import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import { generateDefaultUsers, toSafeUser, hashPassword } from './authService.js';
import type {
  ServerDatabaseSchema,
  StoredReleaseEntity,
  StoredCorrectionEntity,
  UserEntity,
  SafeUser,
  AuditLogEntity,
  SystemConfigEntity,
  UserRole,
  UserStatus,
} from '../types/serverTypes.js';

class StorageService {
  private defaultDb: ServerDatabaseSchema = {
    users: generateDefaultUsers(),
    releases: [],
    corrections: [],
    auditLogs: [],
    systemConfig: {
      geminiModel: config.geminiModel || 'gemini-3.6-flash',
      maxStoredReleases: CONSTANTS.MAX_STORED_RECORDS,
      autoApprovalThreshold: CONSTANTS.RISK_THRESHOLDS.LOW,
      maintenanceMode: false,
      updated_at: new Date().toISOString(),
    },
    config: {
      version: CONSTANTS.VERSION,
      initialized_at: new Date().toISOString(),
    },
  };

  constructor() {
    this.ensureDbExists();
  }

  private ensureDbExists(): void {
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }
    if (!fs.existsSync(config.dbFilePath)) {
      this.writeDatabase(this.defaultDb);
      return;
    }

    // Migration / integrity check: ensure users and collections exist
    try {
      const existing = this.getDatabase();
      let changed = false;
      if (!Array.isArray(existing.users) || existing.users.length === 0) {
        existing.users = generateDefaultUsers();
        changed = true;
      }
      if (!Array.isArray(existing.auditLogs)) {
        existing.auditLogs = [];
        changed = true;
      }
      if (!existing.systemConfig) {
        existing.systemConfig = this.defaultDb.systemConfig;
        changed = true;
      }
      if (changed) {
        this.writeDatabase(existing);
      }
    } catch (e) {
      console.warn('DB integrity migration check note:', e);
    }
  }

  public getDatabase(): ServerDatabaseSchema {
    try {
      if (!fs.existsSync(config.dbFilePath)) {
        return this.defaultDb;
      }
      const raw = fs.readFileSync(config.dbFilePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read DB file, returning fallback:', err);
      return this.defaultDb;
    }
  }

  public writeDatabase(db: ServerDatabaseSchema): void {
    try {
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }
      fs.writeFileSync(config.dbFilePath, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write to DB file:', err);
    }
  }

  // ── User Management Operations ──

  public getAllUsers(filter?: { role?: string; status?: string; search?: string }): SafeUser[] {
    const db = this.getDatabase();
    let users = db.users || [];

    if (filter?.role && filter.role !== 'ALL') {
      users = users.filter((u) => u.role === filter.role);
    }
    if (filter?.status && filter.status !== 'ALL') {
      users = users.filter((u) => u.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      users = users.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    return users.map(toSafeUser);
  }

  public getUserById(id: string): UserEntity | null {
    const db = this.getDatabase();
    return (db.users || []).find((u) => u.id === id) || null;
  }

  public getUserByEmail(email: string): UserEntity | null {
    const db = this.getDatabase();
    const cleanEmail = email.trim().toLowerCase();
    return (db.users || []).find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }

  public createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    status?: UserStatus;
  }): SafeUser {
    const db = this.getDatabase();
    const cleanEmail = userData.email.trim().toLowerCase();

    if (this.getUserByEmail(cleanEmail)) {
      throw new Error(`User with email "${cleanEmail}" already exists.`);
    }

    const { hash, salt } = hashPassword(userData.password);
    const newUser: UserEntity = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: userData.name.trim(),
      email: cleanEmail,
      passwordHash: hash,
      salt: salt,
      role: userData.role || 'user',
      status: userData.status || 'active',
      created_at: new Date().toISOString(),
      last_login_at: null,
    };

    db.users = [newUser, ...(db.users || [])];
    this.writeDatabase(db);
    this.logAudit(newUser.id, newUser.email, 'USER_REGISTER', { role: newUser.role });
    return toSafeUser(newUser);
  }

  public updateUser(
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
      last_login_at?: string;
    },
    adminActorEmail?: string,
  ): SafeUser | null {
    const db = this.getDatabase();
    const userIndex = (db.users || []).findIndex((u) => u.id === id);
    if (userIndex === -1) return null;

    const user = db.users[userIndex];

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.last_login_at !== undefined) user.last_login_at = updates.last_login_at;

    if (updates.password) {
      const { hash, salt } = hashPassword(updates.password);
      user.passwordHash = hash;
      user.salt = salt;
    }

    db.users[userIndex] = user;
    this.writeDatabase(db);

    this.logAudit(id, user.email, 'USER_UPDATE', {
      updates: {
        role: updates.role,
        status: updates.status,
        name: updates.name,
        passwordChanged: !!updates.password,
      },
      actor: adminActorEmail || 'self',
    });

    return toSafeUser(user);
  }

  public deleteUser(id: string, adminActorEmail?: string): boolean {
    const db = this.getDatabase();
    const initialLen = (db.users || []).length;
    const target = db.users.find((u) => u.id === id);

    db.users = (db.users || []).filter((u) => u.id !== id);

    if (db.users.length === initialLen) return false;

    this.writeDatabase(db);
    if (target) {
      this.logAudit(id, target.email, 'USER_DELETE', { actor: adminActorEmail || 'admin' });
    }
    return true;
  }

  // ── Audit Log Operations ──

  public logAudit(userId: string | null, userEmail: string | null, action: string, details?: any): AuditLogEntity {
    const db = this.getDatabase();
    const newLog: AuditLogEntity = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      user_email: userEmail,
      action,
      details: details || {},
      timestamp: new Date().toISOString(),
    };

    db.auditLogs = [newLog, ...(db.auditLogs || [])].slice(0, 1000);
    this.writeDatabase(db);
    return newLog;
  }

  public getAuditLogs(limit = 100): AuditLogEntity[] {
    const db = this.getDatabase();
    return (db.auditLogs || []).slice(0, limit);
  }

  // ── System Configuration ──

  public getSystemConfig(): SystemConfigEntity {
    const db = this.getDatabase();
    return db.systemConfig || this.defaultDb.systemConfig;
  }

  public updateSystemConfig(updates: Partial<SystemConfigEntity>, actorEmail?: string): SystemConfigEntity {
    const db = this.getDatabase();
    db.systemConfig = {
      ...(db.systemConfig || this.defaultDb.systemConfig),
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.writeDatabase(db);
    this.logAudit(null, actorEmail || 'admin', 'SYSTEM_CONFIG_UPDATE', updates);
    return db.systemConfig;
  }

  // ── Release Operations ──

  public getAllReleases(filter?: { decision?: string; search?: string }): StoredReleaseEntity[] {
    const db = this.getDatabase();
    let results = db.releases || [];

    if (filter?.decision && filter.decision !== 'ALL') {
      results = results.filter((r) => r.decision === filter.decision);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.release_id.toLowerCase().includes(q) ||
          r.manifest.changed_modules.some((m) => m.toLowerCase().includes(q)),
      );
    }

    return results;
  }

  public getReleaseById(id: string): StoredReleaseEntity | null {
    const db = this.getDatabase();
    return (db.releases || []).find((r) => r.id === id || r.release_id === id) || null;
  }

  public saveRelease(entity: Omit<StoredReleaseEntity, 'id' | 'created_at'>): StoredReleaseEntity {
    const db = this.getDatabase();
    const newRecord: StoredReleaseEntity = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      ...entity,
    };

    db.releases = [newRecord, ...(db.releases || []).filter((r) => r.id !== newRecord.id)].slice(
      0,
      CONSTANTS.MAX_STORED_RECORDS,
    );
    this.writeDatabase(db);
    return newRecord;
  }

  public deleteRelease(id: string): boolean {
    const db = this.getDatabase();
    const initialLen = (db.releases || []).length;
    db.releases = (db.releases || []).filter((r) => r.id !== id && r.release_id !== id);

    if (db.releases.length === initialLen) return false;
    this.writeDatabase(db);
    return true;
  }

  // ── Correction Operations ──

  public getAllCorrections(): StoredCorrectionEntity[] {
    const db = this.getDatabase();
    return db.corrections || [];
  }

  public saveCorrection(entity: Omit<StoredCorrectionEntity, 'id' | 'created_at'>): StoredCorrectionEntity {
    const db = this.getDatabase();
    const newRecord: StoredCorrectionEntity = {
      id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      ...entity,
    };

    db.corrections = [newRecord, ...(db.corrections || [])].slice(0, 100);
    this.writeDatabase(db);
    return newRecord;
  }

  public deleteCorrection(id: string): boolean {
    const db = this.getDatabase();
    const initialLen = (db.corrections || []).length;
    db.corrections = (db.corrections || []).filter((c) => c.id !== id);

    if (db.corrections.length === initialLen) return false;
    this.writeDatabase(db);
    return true;
  }

  // ── Maintenance & Purge ──

  public purgeData(targets: { releases?: boolean; corrections?: boolean; auditLogs?: boolean }, actorEmail?: string): {
    purgedReleases: number;
    purgedCorrections: number;
    purgedLogs: number;
  } {
    const db = this.getDatabase();
    let purgedReleases = 0;
    let purgedCorrections = 0;
    let purgedLogs = 0;

    if (targets.releases) {
      purgedReleases = db.releases.length;
      db.releases = [];
    }
    if (targets.corrections) {
      purgedCorrections = db.corrections.length;
      db.corrections = [];
    }
    if (targets.auditLogs) {
      purgedLogs = db.auditLogs.length;
      db.auditLogs = [];
    }

    this.writeDatabase(db);
    this.logAudit(null, actorEmail || 'admin', 'SYSTEM_PURGE', { targets, purgedReleases, purgedCorrections, purgedLogs });

    return { purgedReleases, purgedCorrections, purgedLogs };
  }
}

export const storageService = new StorageService();
