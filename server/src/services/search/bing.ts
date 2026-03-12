import type { SearchProvider, SearchResult } from './types.js';

interface BingWebPage {
  name: string;
  url: string;
  snippet: string;
}

interface BingResponse {
  webPages?: {
    value: BingWebPage[];
  };
}

export const bingProvider: SearchProvider = {
  id: 'bing',
  name: 'Bing',
  requiresApiKey: true,

  async search(query: string, numResults: number, apiKey?: string): Promise<SearchResult[]> {
    if (!apiKey) throw new Error('Bing API key required');

    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${numResults}`;
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bing API error: ${res.status} - ${text}`);
    }

    const data = (await res.json()) as BingResponse;

    return (data.webPages?.value || []).map((r) => ({
      title: r.name,
      url: r.url,
      snippet: r.snippet,
    }));
  },
};
