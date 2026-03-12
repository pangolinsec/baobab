/**
 * Unified file text fetcher.
 * Routes to backend API when available, falls back to Dexie local storage.
 */
import { checkBackendAvailable, fetchFileText } from '../api/backend';
import { db } from '../db/database';

export async function fetchFileTextUnified(
  fileId: string,
): Promise<{ id: string; filename: string; extractedText: string | null }> {
  if (await checkBackendAvailable()) {
    return fetchFileText(fileId);
  }

  // Fall back to local Dexie storage
  const localFile = await db.projectFiles.get(fileId);
  if (!localFile) {
    throw new Error(`File not found: ${fileId}`);
  }
  return {
    id: localFile.id,
    filename: localFile.filename,
    extractedText: localFile.extractedText,
  };
}
