import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || '/data';

/**
 * Ensure the data directory exists.
 */
export function ensureDataDir(): string {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  return DATA_DIR;
}

/**
 * Get the path for the SQLite database.
 */
export function getDatabasePath(): string {
  return join(ensureDataDir(), 'baobab.db');
}
