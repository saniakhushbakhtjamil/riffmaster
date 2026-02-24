import Redis from 'ioredis';

import type { AnalysisResult, CompositionResult, GenerateTabRequest } from '@ai-guitar-composer/shared';

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

class InMemoryCacheClient implements CacheClient {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }
}

class RedisCacheClient implements CacheClient {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }
}

let singletonCacheClient: CacheClient | null = null;

export function createCacheClient(): CacheClient {
  if (singletonCacheClient) return singletonCacheClient;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    singletonCacheClient = new RedisCacheClient(redisUrl);
  } else {
    singletonCacheClient = new InMemoryCacheClient();
  }

  return singletonCacheClient;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function getAnalysisCacheKey(req: GenerateTabRequest): string {
  return `analysis:${stableStringify({
    songTitle: req.songTitle,
    artistName: req.artistName,
    tempo: req.tempo
  })}`;
}

export function getCompositionCacheKey(analysis: AnalysisResult): string {
  return `composition:${stableStringify(analysis)}`;
}

export function getGuitarisationCacheKey(composition: CompositionResult): string {
  return `guitarisation:${stableStringify(composition)}`;
}

