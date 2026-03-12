import type { SearchProvider } from './types.js';
import { duckduckgoProvider } from './duckduckgo.js';
import { tavilyProvider } from './tavily.js';
import { bingProvider } from './bing.js';

const providers: Record<string, SearchProvider> = {
  duckduckgo: duckduckgoProvider,
  tavily: tavilyProvider,
  bing: bingProvider,
};

export function getSearchProvider(id: string): SearchProvider | undefined {
  return providers[id];
}

export type { SearchResult, SearchProvider } from './types.js';
