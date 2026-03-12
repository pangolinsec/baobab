import Fastify from 'fastify';
import cors from '@fastify/cors';
import { searchRoutes } from './routes/search.js';
import { filesRoutes } from './routes/files.js';
import { projectRoutes } from './routes/projects.js';
import { modelsRoutes } from './routes/models.js';
import { initDatabase } from './db/index.js';

initDatabase();

const fastify = Fastify({
  logger: true,
});

// CORS configuration — allow frontend on port 5173
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', version: '0.1.0' };
});

// Routes
await fastify.register(searchRoutes, { prefix: '/api/search' });
await fastify.register(filesRoutes, { prefix: '/api/files' });
await fastify.register(projectRoutes, { prefix: '/api/projects' });
await fastify.register(modelsRoutes, { prefix: '/api/models' });

// Start server
try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Baobab API server listening on port 3001');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
