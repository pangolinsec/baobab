import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { saveFile, deleteFileFromDisk, extractText } from '../services/files.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function filesRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE },
  });

  // Upload a file to a project
  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const projectId = (data.fields.projectId as any)?.value as string | undefined;
    if (!projectId) {
      return reply.status(400).send({ error: 'Missing projectId field' });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File too large (10MB max)' });
    }

    const fileId = randomUUID();
    const filename = data.filename;
    const mimeType = data.mimetype;

    const storagePath = await saveFile(projectId, fileId, filename, buffer);
    const extracted = await extractText(buffer, mimeType, filename);

    const db = getDb();
    db.prepare(`
      INSERT INTO project_files (id, project_id, filename, mime_type, size_bytes, extracted_text, storage_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      projectId,
      filename,
      mimeType,
      buffer.length,
      extracted || null,
      storagePath,
      Date.now(),
    );

    return {
      id: fileId,
      projectId,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      extractedTextPreview: extracted ? extracted.slice(0, 200) : null,
    };
  });

  // List files for a project
  fastify.get<{ Params: { projectId: string } }>('/:projectId/list', async (request) => {
    const { projectId } = request.params;
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, project_id, filename, mime_type, size_bytes, SUBSTR(extracted_text, 1, 200) as extracted_text_preview, created_at FROM project_files WHERE project_id = ? ORDER BY created_at DESC'
    ).all(projectId) as any[];

    const files = rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      filename: r.filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      extractedTextPreview: r.extracted_text_preview || null,
    }));

    return { files };
  });

  // Get extracted text for a file
  fastify.get<{ Params: { id: string } }>('/:id/text', async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.prepare(
      'SELECT id, filename, extracted_text FROM project_files WHERE id = ?'
    ).get(id) as any;

    if (!row) {
      return reply.status(404).send({ error: 'File not found' });
    }

    return {
      id: row.id,
      filename: row.filename,
      extractedText: row.extracted_text,
    };
  });

  // Delete a file
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.prepare(
      'SELECT storage_path FROM project_files WHERE id = ?'
    ).get(id) as any;

    if (!row) {
      return reply.status(404).send({ error: 'File not found' });
    }

    deleteFileFromDisk(row.storage_path);
    db.prepare('DELETE FROM project_files WHERE id = ?').run(id);

    return { ok: true };
  });
}
