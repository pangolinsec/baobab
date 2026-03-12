import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { deleteFileFromDisk } from '../services/files.js';

export async function projectRoutes(fastify: FastifyInstance) {
  // List distinct project IDs that have files on the backend
  fastify.get('/list', async () => {
    const db = getDb();
    const rows = db.prepare(
      'SELECT DISTINCT project_id FROM project_files'
    ).all() as Array<{ project_id: string }>;
    return { projectIds: rows.map(r => r.project_id) };
  });

  // Upsert project (metadata lives in IndexedDB, this is a no-op sync point)
  fastify.put('/', async () => {
    return { ok: true };
  });

  // Cascade delete: remove all files for a project, then their disk files
  fastify.delete<{ Params: { id: string } }>('/:id', async (request) => {
    const { id } = request.params;
    const db = getDb();

    const files = db.prepare(
      'SELECT id, storage_path FROM project_files WHERE project_id = ?'
    ).all(id) as Array<{ id: string; storage_path: string }>;

    for (const file of files) {
      deleteFileFromDisk(file.storage_path);
    }

    db.prepare('DELETE FROM project_files WHERE project_id = ?').run(id);

    return { ok: true, deletedFiles: files.length };
  });
}
