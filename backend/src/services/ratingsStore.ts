import type { RatingRequest } from '@riffmaster/shared';

export interface StoredRating extends RatingRequest {
  id: string;
  createdAt: string;
}

// In-memory store — sufficient for research/feedback gathering
const ratings: StoredRating[] = [];

export function saveRating(data: RatingRequest): StoredRating {
  const rating: StoredRating = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  ratings.push(rating);
  console.log(`[ratings] saved: ${rating.id} — ${data.songTitle} by ${data.artistName} — playability:${data.playability} musicality:${data.musicality}`);
  return rating;
}

export function getRatings(songTitle: string, artistName: string): StoredRating[] {
  return ratings.filter(
    (r) =>
      r.songTitle.toLowerCase() === songTitle.toLowerCase() &&
      r.artistName.toLowerCase() === artistName.toLowerCase(),
  );
}

export function getAllRatings(): StoredRating[] {
  return [...ratings];
}
