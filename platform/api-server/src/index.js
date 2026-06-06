import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { connectQueue } from './services/queue.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import deployRoutes from './routes/deploys.js';
import webhookRoutes from './routes/webhooks.js';
import cliRoutes from './routes/cli.js';

async function main() {
  // Initialize database
  await initDb();

  // Connect Redis
  await connectQueue();

  const app = express();

  // Middleware
  app.use(cors());

  // Webhook routes need raw body for HMAC signature verification
  app.use('/api/webhooks', express.json({
    verify: (req, res, buf) => { req.rawBody = buf.toString(); }
  }));

  // Other routes use standard JSON parser
  app.use(express.json());

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/deploys', deployRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/cli', cliRoutes);

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.listen(config.port, () => {
    console.log(`API Server listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API Server:', err);
  process.exit(1);
});
