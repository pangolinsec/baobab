import { mkdirSync, writeFileSync, unlinkSync, readdirSync, rmdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { ensureDataDir } from './storage.js';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.css',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.rb', '.java', '.c',
  '.cpp', '.h', '.hpp', '.sh', '.bash', '.zsh', '.fish', '.toml', '.ini',
  '.cfg', '.conf', '.env', '.log', '.sql', '.graphql', '.proto', '.lua',
  '.r', '.R', '.swift', '.kt', '.scala', '.clj', '.ex', '.exs', '.erl',
  '.hs', '.ml', '.vim', '.el', '.lisp', '.php', '.pl', '.pm',
]);

function getFilesDir(): string {
  return join(ensureDataDir(), 'files');
}

export async function saveFile(
  projectId: string,
  fileId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const dir = join(getFilesDir(), projectId);
  mkdirSync(dir, { recursive: true });
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = join(dir, `${fileId}_${safeName}`);
  await writeFile(storagePath, buffer);
  return storagePath;
}

export function deleteFileFromDisk(storagePath: string): void {
  try {
    unlinkSync(storagePath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Try to remove the parent directory if empty
  try {
    const dir = dirname(storagePath);
    if (readdirSync(dir).length === 0) {
      rmdirSync(dir);
    }
  } catch {
    // Ignore — directory may not be empty or already removed
  }
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const ext = getExtension(filename);

  // Text/code files
  if (
    mimeType.startsWith('text/') ||
    TEXT_EXTENSIONS.has(ext) ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml'
  ) {
    return buffer.toString('utf-8');
  }

  // PDF
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err) {
      console.error('PDF extraction failed:', err);
      return '';
    }
  }

  // Images — OCR via tesseract.js
  if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const result = await worker.recognize(buffer);
      await worker.terminate();
      return result.data.text;
    } catch (err) {
      console.error('OCR extraction failed:', err);
      return '';
    }
  }

  // Unknown type — no extraction
  return '';
}
