import type { ProjectFile } from '../types';
import { fetchFileTextUnified } from './fileStorage';

// Matches @filename.ext — filename can contain letters, numbers, dots, hyphens, underscores
// No `g` flag: safe for .test() calls that would mutate lastIndex on a global regex.
const AT_MENTION_REGEX = /(?:^|(?<=\s))@([\w][\w.\-]*\.\w+)(?=\s|$)/;

/**
 * Extract all @filename references from a message string.
 */
export function extractFileReferences(content: string): string[] {
  // matchAll requires the `g` flag — use a fresh local instance to avoid shared state.
  const globalRe = new RegExp(AT_MENTION_REGEX.source, 'g');
  const matches: string[] = [];
  for (const match of content.matchAll(globalRe)) {
    matches.push(match[1]);
  }
  return [...new Set(matches)];
}

/**
 * Check if content contains any @filename references.
 */
export function hasFileReferences(content: string): boolean {
  return AT_MENTION_REGEX.test(content);
}

/**
 * Resolve all @filename references in a message, replacing them with the file's
 * extracted text wrapped in markers. Uses the project's file list to match
 * filenames to file IDs, then fetches the full text from the backend.
 *
 * Returns the resolved content string. Unmatched references are replaced with
 * a "[File not found: ...]" placeholder.
 */
export async function resolveFileReferences(
  content: string,
  files: ProjectFile[],
  sharedTextCache?: Map<string, string>,
): Promise<string> {
  const filenames = extractFileReferences(content);
  if (filenames.length === 0) return content;

  // Build a filename -> file lookup (case-insensitive)
  const fileMap = new Map<string, ProjectFile>();
  for (const f of files) {
    fileMap.set(f.filename.toLowerCase(), f);
  }

  // Use shared cache if provided, otherwise fetch locally
  const textCache = sharedTextCache ?? new Map<string, string>();
  if (!sharedTextCache) {
    await Promise.all(
      filenames.map(async (filename) => {
        const file = fileMap.get(filename.toLowerCase());
        if (!file) return;
        try {
          const data = await fetchFileTextUnified(file.id);
          textCache.set(filename.toLowerCase(), data.extractedText || '');
        } catch {
          // Will show as "not found" below
        }
      })
    );
  }

  // Replace each reference
  let resolved = content;
  // Use a fresh regex instance for replacement
  resolved = resolved.replace(
    /(?:^|(?<=\s))@([\w][\w.\-]*\.\w+)(?=\s|$)/g,
    (_match, filename: string) => {
      const text = textCache.get(filename.toLowerCase());
      if (text !== undefined) {
        return `[Content of ${filename}]\n${text}\n[End of ${filename}]`;
      }
      return `[File not found: ${filename}]`;
    }
  );

  return resolved;
}

/**
 * Build a file index string for the agentic system prompt augmentation.
 */
export function buildFileIndex(files: ProjectFile[]): string {
  if (files.length === 0) return '';

  const lines = files.map(f => {
    const sizeStr = f.sizeBytes < 1024
      ? `${f.sizeBytes} B`
      : f.sizeBytes < 1024 * 1024
        ? `${(f.sizeBytes / 1024).toFixed(1)} KB`
        : `${(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    const preview = f.extractedTextPreview
      ? ` — ${f.extractedTextPreview.slice(0, 80).replace(/\n/g, ' ')}`
      : '';
    return `- ${f.filename} (${sizeStr})${preview}`;
  });

  return [
    'You have access to the following project files. Use the read_file tool to access their contents when relevant.',
    '',
    'Files:',
    ...lines,
  ].join('\n');
}
