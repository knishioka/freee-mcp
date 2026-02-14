import { createHash } from 'node:crypto';

class CacheEntry<T> {
  constructor(
    public data: T,
    public expiresAt: number,
  ) {}

  get isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }
}

export class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry || entry.isExpired) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, new CacheEntry(data, Date.now() + ttlMs));
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

export function generateCacheKey(
  companyId: number,
  endpoint: string,
  params?: Record<string, unknown>,
): string {
  const filteredParams = params
    ? Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b)),
    )
    : undefined;

  if (!filteredParams || Object.keys(filteredParams).length === 0) {
    return `${companyId}:${endpoint}:all`;
  }

  const hash = createHash('md5')
    .update(JSON.stringify(filteredParams))
    .digest('hex');

  return `${companyId}:${endpoint}:${hash}`;
}
