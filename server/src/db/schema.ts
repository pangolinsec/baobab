import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projectFiles = sqliteTable('project_files', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  extractedText: text('extracted_text'),
  storagePath: text('storage_path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
