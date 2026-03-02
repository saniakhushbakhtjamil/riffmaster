import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { RatingRequest } from '@riffmaster/shared';

export interface StoredRating extends RatingRequest {
  id: string;
  createdAt: string;
}

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const RATINGS_FILE = join(DATA_DIR, 'ratings.json');

function loadFromDisk(): StoredRating[] {
  try {
    if (!existsSync(RATINGS_FILE)) return [];
    return JSON.parse(readFileSync(RATINGS_FILE, 'utf-8')) as StoredRating[];
  } catch (err) {
    console.warn('[ratings] failed to load ratings.json:', err);
    return [];
  }
}

function saveToDisk(data: StoredRating[]): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(RATINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[ratings] failed to write ratings.json:', err);
  }
}

// Load on startup
const ratings: StoredRating[] = loadFromDisk();
console.log(`[ratings] loaded ${ratings.length} rating(s) from disk`);

export function saveRating(data: RatingRequest): StoredRating {
  const rating: StoredRating = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  ratings.push(rating);
  saveToDisk(ratings);
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
