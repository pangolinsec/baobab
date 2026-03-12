import type { SearchProvider, SearchResult } from './types.js';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

interface InstantAnswerResponse {
  Abstract?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Heading?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

function decodeEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchInstantAnswer(query: string): Promise<SearchResult | null> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) return null;

    const data = (await res.json()) as InstantAnswerResponse;

    if (data.AbstractText && data.AbstractURL) {
      return {
        title: data.Heading || 'Direct Answer',
        url: data.AbstractURL,
        snippet: data.AbstractText,
        isInstantAnswer: true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch web results from DuckDuckGo's lite HTML interface.
 *
 * This uses lite.duckduckgo.com which returns simple HTML that doesn't
 * require JavaScript execution, avoiding the TLS fingerprint-based bot
 * detection that blocks the main DDG search API and scraping libraries
 * like duck-duck-scrape. See ADR-014 for context.
 */
async function fetchWebResults(
  query: string,
  numResults: number,
): Promise<SearchResult[]> {
  const body = new URLSearchParams({ q: query });
  const res = await fetch('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  // 202 = rate limited by DDG
  if (res.status === 202) {
    throw new Error('DuckDuckGo rate limit (HTTP 202). Try again shortly.');
  }
  if (!res.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${res.status}`);
  }

  const html = await res.text();

  // Parse result-link anchors: <a rel="nofollow" href="URL" class='result-link'>Title</a>
  const linkRegex =
    /<a\s+rel="nofollow"\s+href="([^"]+)"\s+class='result-link'>([\s\S]*?)<\/a>/g;
  const links: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    links.push({ url: m[1], title: decodeEntities(m[2]) });
  }

  // Parse result-snippet cells: <td class='result-snippet'>Snippet text</td>
  const snipRegex = /<td\s+class='result-snippet'>([\s\S]*?)<\/td>/g;
  const snippets: string[] = [];
  while ((m = snipRegex.exec(html)) !== null) {
    snippets.push(decodeEntities(m[1]));
  }

  return links.slice(0, numResults).map((link, i) => ({
    title: link.title,
    url: link.url,
    snippet: snippets[i] || '',
  }));
}

export const duckduckgoProvider: SearchProvider = {
  id: 'duckduckgo',
  name: 'DuckDuckGo',
  requiresApiKey: false,

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    // Fire both requests in parallel (ADR-014)
    const [liteResult, instantAnswer] = await Promise.allSettled([
      fetchWebResults(query, numResults),
      fetchInstantAnswer(query),
    ]);

    const webResults =
      liteResult.status === 'fulfilled' ? liteResult.value : [];
    const instant =
      instantAnswer.status === 'fulfilled' ? instantAnswer.value : null;

    // If lite backend succeeded, prepend instant answer (if any)
    if (webResults.length > 0) {
      return instant ? [instant, ...webResults] : webResults;
    }

    // Lite failed — fall back to instant answer alone
    if (instant) {
      return [instant];
    }

    // Both failed — surface the lite error if available
    const liteError =
      liteResult.status === 'rejected' ? liteResult.reason?.message : '';
    throw new Error(
      `DuckDuckGo search failed: ${liteError || 'no results from lite search or instant answer API'}`,
    );
  },
};
