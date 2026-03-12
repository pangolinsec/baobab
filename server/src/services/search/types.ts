export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  isInstantAnswer?: boolean;
}

export interface SearchProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  search(query: string, numResults: number, apiKey?: string): Promise<SearchResult[]>;
}
