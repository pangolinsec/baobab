/**
 * Backend API client.
 * Connects to the Fastify server on port 3001.
 */

const BACKEND_URL = 'http://localhost:3001';

export class BackendError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

let _isAvailable: boolean | null = null;
let _lastCheck = 0;
const CHECK_INTERVAL = 30_000; // 30 seconds

/**
 * Check if the backend server is available.
 * Caches the result for 30 seconds.
 */
export async function checkBackendAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_isAvailable !== null && now - _lastCheck < CHECK_INTERVAL) {
    return _isAvailable;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    _isAvailable = response.ok;
  } catch {
    _isAvailable = false;
  }
  _lastCheck = now;
  return _isAvailable;
}

/**
 * Synchronous check — returns last known state.
 * Returns false if never checked.
 */
export function isBackendAvailable(): boolean {
  return _isAvailable ?? false;
}

/**
 * Reset the cached state (e.g., on tab refocus).
 */
export function resetBackendCheck(): void {
  _isAvailable = null;
  _lastCheck = 0;
}

// --- Feature 13: File management API ---

import type { ProjectFile } from '../types';

export async function fetchProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const res = await fetch(`${BACKEND_URL}/api/files/${projectId}/list`);
  if (!res.ok) {
    throw new BackendError(`Failed to list files: ${res.statusText}`, res.status);
  }
  const data = await res.json();
  return data.files;
}

export async function uploadProjectFile(projectId: string, file: File): Promise<ProjectFile> {
  const form = new FormData();
  form.append('projectId', projectId);
  form.append('file', file);

  const res = await fetch(`${BACKEND_URL}/api/files/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BackendError(body.error || `Upload failed: ${res.statusText}`, res.status);
  }
  return res.json();
}

export async function deleteProjectFile(fileId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/files/${fileId}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new BackendError(`Failed to delete file: ${res.statusText}`, res.status);
  }
}

export async function fetchFileText(fileId: string): Promise<{ id: string; filename: string; extractedText: string | null }> {
  const res = await fetch(`${BACKEND_URL}/api/files/${fileId}/text`);
  if (!res.ok) {
    throw new BackendError(`Failed to fetch file text: ${res.statusText}`, res.status);
  }
  return res.json();
}

export async function deleteBackendProject(projectId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new BackendError(`Failed to delete project: ${res.statusText}`, res.status);
  }
}
