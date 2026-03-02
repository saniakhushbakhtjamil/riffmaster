import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';

import { generateTabRequestSchema, type GenerateTabRequest } from '@riffmaster/shared';

import { runAnalysisStep } from '../pipeline/analysis.js';
import { createCacheClient, getAnalysisCacheKey } from '../services/cache.js';
import type { AnalysisResult } from '@riffmaster/shared';

function handleAnalyse(req: Request, res: Response) {
  const parseResult = generateTabRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.flatten(),
    });
  }

  const typedRequest: GenerateTabRequest = parseResult.data;

  void (async () => {
    try {
      const cache = createCacheClient();
      const key = getAnalysisCacheKey(typedRequest);

      let analysis: AnalysisResult;
      const cached = await cache.get(key);
      if (cached) {
        analysis = JSON.parse(cached) as AnalysisResult;
      } else {
        analysis = await runAnalysisStep(typedRequest);
        await cache.set(key, JSON.stringify(analysis), 60 * 60);
      }

      res.json(analysis);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in /api/analyse', error);
      res.status(500).json({ error: 'Failed to analyse song' });
    }
  })();
}

export function analyseRouter(): Router {
  const router = createRouter();
  router.post('/analyse', (req, res) => {
    handleAnalyse(req, res);
  });
  return router;
}
