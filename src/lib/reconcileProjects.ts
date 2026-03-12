/**
 * Startup reconciliation: clean up orphaned backend project files
 * when a project was deleted from the frontend while the backend was offline.
 */
import { checkBackendAvailable, deleteBackendProject } from '../api/backend';
import { db } from '../db/database';

const BACKEND_URL = 'http://localhost:3001';

export async function reconcileOrphanedBackendProjects(): Promise<void> {
  try {
    const available = await checkBackendAvailable();
    if (!available) return;

    // Fetch backend project IDs
    const res = await fetch(`${BACKEND_URL}/api/projects/list`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;

    const { projectIds } = (await res.json()) as { projectIds: string[] };
    if (!projectIds || projectIds.length === 0) return;

    // Load frontend project IDs from Dexie
    const frontendProjects = await db.projects.toArray();
    const frontendIds = new Set(frontendProjects.map(p => p.id));

    // Delete orphaned backend projects
    for (const backendId of projectIds) {
      if (!frontendIds.has(backendId)) {
        console.log(`[reconcile] Cleaning up orphaned backend project: ${backendId}`);
        await deleteBackendProject(backendId).catch(err => {
          console.error(`[reconcile] Failed to delete orphaned project ${backendId}:`, err);
        });
      }
    }
  } catch (err) {
    console.error('[reconcile] Project reconciliation failed:', err);
  }
}
