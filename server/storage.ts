import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface ServerDatabase {
  releases: any[];
  corrections: any[];
  config: {
    version: string;
    initialized_at: string;
  };
}

const DEFAULT_DB: ServerDatabase = {
  releases: [],
  corrections: [],
  config: {
    version: '1.0.0',
    initialized_at: new Date().toISOString(),
  },
};

function ensureDbExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  }
}

export function readDatabase(): ServerDatabase {
  ensureDbExists();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file, returning default:', err);
    return DEFAULT_DB;
  }
}

export function writeDatabase(db: ServerDatabase): void {
  ensureDbExists();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}
