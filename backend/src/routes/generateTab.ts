import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';

import {
  generateTabRequestSchema,
  generateTabResponseSchema,
  type GenerateTabRequest
} from '@ai-guitar-composer/shared';

import { runGenerateTabPipeline } from '../pipeline/index.js';

function handleGenerateTab(req: Request, res: Response) {
  const parseResult = generateTabRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.flatten()
    });
  }

  const typedRequest: GenerateTabRequest = parseResult.data;

  void (async () => {
    try {
      const result = await runGenerateTabPipeline(typedRequest);
      const validated = generateTabResponseSchema.parse(result);
      res.json(validated);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in /api/generate-tab', error);
      res.status(500).json({ error: 'Failed to generate tab' });
    }
  })();
}

export function generateTabRouter(): Router {
  const router = createRouter();

  router.post('/generate-tab', (req, res) => {
    handleGenerateTab(req, res);
  });

  return router;
}

