import type { ToolDefinition } from './providers/types';
import type { ProjectFile } from '../types';
import { executeSearch, formatSearchResults } from './search';
import { fetchFileTextUnified } from '../lib/fileStorage';

// Registry of all known tool definitions, keyed by tool name
const TOOL_REGISTRY: Record<string, ToolDefinition> = {};

/** Get tool definitions for a set of tool names (filters to known tools). */
export function getToolDefinitionsForNames(names: Set<string>): ToolDefinition[] {
  return [...names].filter(n => TOOL_REGISTRY[n]).map(n => TOOL_REGISTRY[n]);
}

export const webSearchTool: ToolDefinition = TOOL_REGISTRY['web_search'] = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date facts, recent events, or information you are uncertain about.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return (1-10, default 5)',
      },
    },
    required: ['query'],
  },
};

export function createToolExecutor(
  searchProvider: string,
  searchApiKey?: string,
): (toolName: string, input: Record<string, unknown>) => Promise<string> {
  return async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    if (toolName === 'web_search') {
      const query = input.query as string;
      const numResults = (input.num_results as number) || 5;
      try {
        const results = await executeSearch(searchProvider, query, numResults, searchApiKey);
        return formatSearchResults(results);
      } catch (err) {
        return `Search failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    return `Unknown tool: ${toolName}`;
  };
}

export const readFileTool: ToolDefinition = TOOL_REGISTRY['read_file'] = {
  name: 'read_file',
  description: 'Read the content of a project knowledge file. Returns the extracted text content of the file.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'The filename to read (e.g., "notes.md", "data.csv")',
      },
    },
    required: ['filename'],
  },
};

export function createReadFileExecutor(
  files: ProjectFile[],
): (toolName: string, input: Record<string, unknown>) => Promise<string> {
  // Build filename -> file ID lookup (case-insensitive)
  const fileMap = new Map<string, ProjectFile>();
  for (const f of files) {
    fileMap.set(f.filename.toLowerCase(), f);
  }

  return async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    if (toolName !== 'read_file') return `Unknown tool: ${toolName}`;

    const filename = input.filename as string;
    if (!filename) return 'Error: filename is required';

    const file = fileMap.get(filename.toLowerCase());
    if (!file) {
      return `File not found: ${filename}. Available files: ${files.map(f => f.filename).join(', ')}`;
    }

    try {
      const data = await fetchFileTextUnified(file.id);
      return data.extractedText || '(File has no extracted text content)';
    } catch (err) {
      return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}
