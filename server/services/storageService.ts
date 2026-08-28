import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import type { ServerDatabaseSchema, StoredReleaseEntity, StoredCorrectionEntity } from '../types/serverTypes.js';

class StorageService {
  private defaultDb: ServerDatabaseSchema = {
    releases: [],
    corrections: [],
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
      fs.writeFileSync(config.dbFilePath, JSON.stringify(this.defaultDb, null, 2), 'utf-8');
    }
  }

  public getDatabase(): ServerDatabaseSchema {
    this.ensureDbExists();
    try {
      const raw = fs.readFileSync(config.dbFilePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read DB file, returning fallback:', err);
      return this.defaultDb;
    }
  }

  public writeDatabase(db: ServerDatabaseSchema): void {
    this.ensureDbExists();
    try {
      fs.writeFileSync(config.dbFilePath, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write to DB file:', err);
    }
  }

  // ── Release Operations ──
  public getAllReleases(filter?: { decision?: string; search?: string }): StoredReleaseEntity[] {
    const db = this.getDatabase();
    let results = db.releases;

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
    return db.releases.find((r) => r.id === id || r.release_id === id) || null;
  }

  public saveRelease(entity: Omit<StoredReleaseEntity, 'id' | 'created_at'>): StoredReleaseEntity {
    const db = this.getDatabase();
    const newRecord: StoredReleaseEntity = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      ...entity,
    };

    db.releases = [newRecord, ...db.releases.filter((r) => r.id !== newRecord.id)].slice(
      0,
      CONSTANTS.MAX_STORED_RECORDS,
    );
    this.writeDatabase(db);
    return newRecord;
  }

  public deleteRelease(id: string): boolean {
    const db = this.getDatabase();
    const initialLen = db.releases.length;
    db.releases = db.releases.filter((r) => r.id !== id && r.release_id !== id);

    if (db.releases.length === initialLen) return false;
    this.writeDatabase(db);
    return true;
  }

  // ── Correction Operations ──
  public getAllCorrections(): StoredCorrectionEntity[] {
    const db = this.getDatabase();
    return db.corrections;
  }

  public saveCorrection(entity: Omit<StoredCorrectionEntity, 'id' | 'created_at'>): StoredCorrectionEntity {
    const db = this.getDatabase();
    const newRecord: StoredCorrectionEntity = {
      id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      ...entity,
    };

    db.corrections = [newRecord, ...db.corrections].slice(0, 100);
    this.writeDatabase(db);
    return newRecord;
  }

  public deleteCorrection(id: string): boolean {
    const db = this.getDatabase();
    const initialLen = db.corrections.length;
    db.corrections = db.corrections.filter((c) => c.id !== id);

    if (db.corrections.length === initialLen) return false;
    this.writeDatabase(db);
    return true;
  }
}

export const storageService = new StorageService();
