import { db } from '../db/database';
import type { TreeNode } from '../types';

export interface SearchResult {
  node: TreeNode;
  conversationId: string;
  conversationTitle: string;
  snippet: string;
}

export interface SearchFilters {
  roles: ('user' | 'assistant')[];
  starredOnly: boolean;
}

const DEFAULT_FILTERS: SearchFilters = {
  roles: ['user', 'assistant'],
  starredOnly: false,
};

/**
 * Search all messages across all conversations using Dexie filter.
 */
export async function searchMessages(
  query: string,
  filters: SearchFilters = DEFAULT_FILTERS
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  // Load all conversations for title lookup
  const conversations = await db.conversations.toArray();
  const convMap = new Map(conversations.map(c => [c.id, c.title]));

  // Filter nodes by content match
  const allNodes = await db.nodes.toArray();
  const results: SearchResult[] = [];

  for (const node of allNodes) {
    // Skip empty or error nodes
    if (!node.content || node.content.startsWith('Error: ')) continue;

    // Skip root greeting nodes
    if (node.parentId === null && node.role === 'assistant') continue;

    // Apply role filter
    if (!filters.roles.includes(node.role)) continue;

    // Apply starred filter
    if (filters.starredOnly && !node.starred) continue;

    // Content match
    if (!node.content.toLowerCase().includes(lowerQuery)) continue;

    results.push({
      node,
      conversationId: node.conversationId,
      conversationTitle: convMap.get(node.conversationId) || 'Unknown',
      snippet: getHighlightedSnippet(node.content, query),
    });
  }

  // Sort by recency
  results.sort((a, b) => b.node.createdAt - a.node.createdAt);

  return results;
}

/**
 * Search within the current conversation's loaded nodes.
 */
export function searchInConversation(
  query: string,
  nodes: Record<string, TreeNode>,
  filters: SearchFilters = DEFAULT_FILTERS
): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const node of Object.values(nodes)) {
    if (!node.content || node.content.startsWith('Error: ')) continue;
    if (node.parentId === null && node.role === 'assistant') continue;
    if (!filters.roles.includes(node.role)) continue;
    if (filters.starredOnly && !node.starred) continue;
    if (!node.content.toLowerCase().includes(lowerQuery)) continue;

    results.push({
      node,
      conversationId: node.conversationId,
      conversationTitle: '',
      snippet: getHighlightedSnippet(node.content, query),
    });
  }

  results.sort((a, b) => b.node.createdAt - a.node.createdAt);
  return results;
}

/**
 * Get a snippet with context around the first match.
 */
export function getHighlightedSnippet(
  content: string,
  query: string,
  contextChars: number = 60
): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) return content.slice(0, contextChars * 2);

  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + query.length + contextChars);

  let snippet = '';
  if (start > 0) snippet += '…';
  snippet += content.slice(start, end);
  if (end < content.length) snippet += '…';

  return snippet;
}
