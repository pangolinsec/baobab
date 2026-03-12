import type { SearchProvider, SearchResult } from './types.js';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export const tavilyProvider: SearchProvider = {
  id: 'tavily',
  name: 'Tavily',
  requiresApiKey: true,

  async search(query: string, numResults: number, apiKey?: string): Promise<SearchResult[]> {
    if (!apiKey) throw new Error('Tavily API key required');

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: numResults,
        search_depth: 'basic',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tavily API error: ${res.status} - ${text}`);
    }

    const data = (await res.json()) as TavilyResponse;

    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  },
};
