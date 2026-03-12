import type { FastifyInstance } from 'fastify';
import { getSearchProvider } from '../services/search/index.js';

interface SearchBody {
  provider: string;
  query: string;
  numResults?: number;
  apiKey?: string;
}

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: SearchBody }>('/', async (request, reply) => {
    const { provider: providerId, query, numResults = 5, apiKey } = request.body;

    if (!providerId || !query) {
      return reply.status(400).send({ error: 'Missing required fields: provider, query' });
    }

    const provider = getSearchProvider(providerId);
    if (!provider) {
      return reply.status(400).send({ error: `Unknown search provider: ${providerId}` });
    }

    if (provider.requiresApiKey && !apiKey) {
      return reply.status(400).send({ error: `API key required for ${provider.name}` });
    }

    try {
      const results = await provider.search(query, Math.min(numResults, 10), apiKey);
      return { results, provider: providerId, query };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ error: `Search failed: ${message}` });
    }
  });
}
