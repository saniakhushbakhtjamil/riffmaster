import express from 'express';
import cors from 'cors';

import { generateTabRouter } from './routes/generateTab.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGIN ?? '*'
    })
  );
  app.use(express.json());

  app.use('/api', generateTabRouter());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

