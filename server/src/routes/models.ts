import type { FastifyInstance } from 'fastify';

export async function modelsRoutes(fastify: FastifyInstance) {
  // Placeholder — will proxy model listing for CORS-restricted providers
  fastify.get('/', async () => {
    return { models: [], message: 'Models endpoint placeholder' };
  });
}
