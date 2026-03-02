import { Router } from 'express';
import { ratingRequestSchema } from '@riffmaster/shared';
import { saveRating, getRatings } from '../services/ratingsStore.js';

export function ratingsRouter(): Router {
  const router = Router();

  router.post('/ratings', (req, res) => {
    const parsed = ratingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid request: ${parsed.error.message}` });
      return;
    }
    const rating = saveRating(parsed.data);
    res.status(201).json({ id: rating.id, createdAt: rating.createdAt });
  });

  router.get('/ratings/:songTitle/:artistName', (req, res) => {
    const { songTitle, artistName } = req.params;
    const results = getRatings(
      decodeURIComponent(songTitle),
      decodeURIComponent(artistName),
    );
    res.json(results);
  });

  return router;
}
