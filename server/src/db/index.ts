import Database from 'better-sqlite3';
import { getDatabasePath } from '../services/storage.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(getDatabasePath());
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      extracted_text TEXT,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Idempotent column additions for migrations
  const columns = db.pragma('table_info(project_files)') as Array<{ name: string }>;
  const colNames = new Set(columns.map(c => c.name));

  if (!colNames.has('extracted_text')) {
    db.exec('ALTER TABLE project_files ADD COLUMN extracted_text TEXT');
  }
}
