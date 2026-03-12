import { create } from 'zustand';
import type { SearchResult, SearchFilters } from '../lib/search';
import { searchMessages, searchInConversation } from '../lib/search';
import type { TreeNode } from '../types';

interface SearchState {
  // Global search
  globalQuery: string;
  globalResults: SearchResult[];
  isSearching: boolean;

  // Per-chat search
  chatQuery: string;
  chatResults: SearchResult[];
  currentResultIndex: number;

  // Filters
  filters: SearchFilters;

  // Actions
  setGlobalQuery: (query: string) => void;
  executeGlobalSearch: () => Promise<void>;
  clearGlobalSearch: () => void;

  setChatQuery: (query: string) => void;
  executeChatSearch: (nodes: Record<string, TreeNode>) => void;
  clearChatSearch: () => void;

  nextResult: () => void;
  prevResult: () => void;

  setFilters: (filters: Partial<SearchFilters>) => void;

  // Get matching node IDs for highlighting
  getMatchingNodeIds: () => Set<string>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  globalQuery: '',
  globalResults: [],
  isSearching: false,

  chatQuery: '',
  chatResults: [],
  currentResultIndex: 0,

  filters: {
    roles: ['user', 'assistant'],
    starredOnly: false,
  },

  setGlobalQuery: (globalQuery: string) => {
    set({ globalQuery });
  },

  executeGlobalSearch: async () => {
    const { globalQuery, filters } = get();
    if (!globalQuery.trim()) {
      set({ globalResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    const results = await searchMessages(globalQuery, filters);
    set({ globalResults: results, isSearching: false });
  },

  clearGlobalSearch: () => {
    set({ globalQuery: '', globalResults: [], isSearching: false });
  },

  setChatQuery: (chatQuery: string) => {
    set({ chatQuery, currentResultIndex: 0 });
  },

  executeChatSearch: (nodes: Record<string, TreeNode>) => {
    const { chatQuery, filters } = get();
    if (!chatQuery.trim()) {
      set({ chatResults: [], currentResultIndex: 0 });
      return;
    }
    const results = searchInConversation(chatQuery, nodes, filters);
    set({ chatResults: results, currentResultIndex: 0 });
  },

  clearChatSearch: () => {
    set({ chatQuery: '', chatResults: [], currentResultIndex: 0 });
  },

  nextResult: () => {
    const { chatResults, currentResultIndex } = get();
    if (chatResults.length === 0) return;
    set({ currentResultIndex: (currentResultIndex + 1) % chatResults.length });
  },

  prevResult: () => {
    const { chatResults, currentResultIndex } = get();
    if (chatResults.length === 0) return;
    set({ currentResultIndex: (currentResultIndex - 1 + chatResults.length) % chatResults.length });
  },

  setFilters: (newFilters: Partial<SearchFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
    // Re-execute search with new filters
    const { globalQuery } = get();
    if (globalQuery.trim()) {
      get().executeGlobalSearch();
    }
  },

  getMatchingNodeIds: () => {
    const { chatResults } = get();
    return new Set(chatResults.map(r => r.node.id));
  },
}));
