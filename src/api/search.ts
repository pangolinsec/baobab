export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  isInstantAnswer?: boolean;
}

export async function executeSearch(
  provider: string,
  query: string,
  numResults: number = 5,
  apiKey?: string,
): Promise<SearchResult[]> {
  const res = await fetch('http://localhost:3001/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, query, numResults, apiKey }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Search request failed' }));
    throw new Error(body.error || `Search failed: ${res.status}`);
  }

  const data = await res.json();
  return data.results as SearchResult[];
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'No search results found.';

  return results
    .map((r, i) => {
      if (r.isInstantAnswer) {
        return `[Direct Answer] ${r.title}\n${r.snippet}\nSource: ${r.url}`;
      }
      return `${i + 1}. ${r.title}\n${r.snippet}\nURL: ${r.url}`;
    })
    .join('\n\n');
}
