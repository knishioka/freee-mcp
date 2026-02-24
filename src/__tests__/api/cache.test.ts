import { ApiCache, generateCacheKey } from '../../api/cache.js';

describe('ApiCache', () => {
  let cache: ApiCache;

  beforeEach(() => {
    cache = new ApiCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('get/set', () => {
    it('should return undefined for cache miss', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should return cached value on cache hit', () => {
      const data = [{ id: 1, name: 'Test' }];
      cache.set('key', data, 10000);
      expect(cache.get('key')).toEqual(data);
    });

    it('should return typed value', () => {
      interface Item {
        id: number;
        name: string;
      }
      const data: Item[] = [{ id: 1, name: 'Test' }];
      cache.set('key', data, 10000);
      const result = cache.get<Item[]>('key');
      expect(result).toEqual(data);
      expect(result?.[0].id).toBe(1);
    });

    it('should store multiple entries independently', () => {
      cache.set('key1', 'value1', 10000);
      cache.set('key2', 'value2', 10000);
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });

    it('should overwrite existing entry with same key', () => {
      cache.set('key', 'old', 10000);
      cache.set('key', 'new', 10000);
      expect(cache.get('key')).toBe('new');
    });
  });

  describe('TTL expiry', () => {
    it('should return value before TTL expires', () => {
      cache.set('key', 'value', 5000);
      jest.advanceTimersByTime(4999);
      expect(cache.get('key')).toBe('value');
    });

    it('should return undefined after TTL expires', () => {
      cache.set('key', 'value', 5000);
      jest.advanceTimersByTime(5001);
      expect(cache.get('key')).toBeUndefined();
    });

    it('should clean up expired entry on access', () => {
      cache.set('key', 'value', 100);
      expect(cache.size).toBe(1);
      jest.advanceTimersByTime(101);
      cache.get('key'); // triggers cleanup
      expect(cache.size).toBe(0);
    });

    it('should handle different TTLs for different keys', () => {
      cache.set('short', 'value1', 1000);
      cache.set('long', 'value2', 10000);

      jest.advanceTimersByTime(1001);
      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value2');
    });
  });

  describe('invalidate', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set('123:partners:all', [], 10000);
      cache.set('123:partners:hash1', [], 10000);
      cache.set('123:sections:all', [], 10000);

      cache.invalidate('123:partners');

      expect(cache.get('123:partners:all')).toBeUndefined();
      expect(cache.get('123:partners:hash1')).toBeUndefined();
      expect(cache.get('123:sections:all')).toEqual([]);
    });

    it('should not invalidate non-matching entries', () => {
      cache.set('123:partners:all', 'a', 10000);
      cache.set('456:partners:all', 'b', 10000);

      cache.invalidate('123:partners');

      expect(cache.get('123:partners:all')).toBeUndefined();
      expect(cache.get('456:partners:all')).toBe('b');
    });

    it('should handle invalidating with no matches', () => {
      cache.set('123:sections:all', 'value', 10000);
      cache.invalidate('999:partners');
      expect(cache.get('123:sections:all')).toBe('value');
    });

    it('should invalidate all entries matching broad pattern', () => {
      cache.set('123:partners:all', [], 10000);
      cache.set('123:partners:abc', [], 10000);
      cache.set('123:partners:def', [], 10000);

      cache.invalidate('123:partners');
      expect(cache.size).toBe(0);
    });

    it('should not match partial company ID prefixes (startsWith safety)', () => {
      cache.set('12:partners:all', 'company12', 10000);
      cache.set('123:partners:all', 'company123', 10000);
      cache.set('1234:partners:all', 'company1234', 10000);

      cache.invalidate('12:partners');

      expect(cache.get('12:partners:all')).toBeUndefined();
      expect(cache.get('123:partners:all')).toBe('company123');
      expect(cache.get('1234:partners:all')).toBe('company1234');
    });
  });

  describe('eviction', () => {
    it('should evict expired entries when max size reached', () => {
      // Fill cache with expired entries
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`, 100);
      }
      expect(cache.size).toBe(1000);

      // Advance past TTL
      jest.advanceTimersByTime(101);

      // Adding new entry should trigger eviction
      cache.set('new-key', 'new-value', 10000);
      expect(cache.size).toBe(1);
      expect(cache.get('new-key')).toBe('new-value');
    });

    it('should not exceed MAX_ENTRIES when all entries are unexpired', () => {
      // Fill cache with unexpired entries
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`, 60000);
      }
      expect(cache.size).toBe(1000);

      // Adding new entry should evict oldest (FIFO) without exceeding limit
      cache.set('new-key', 'new-value', 60000);
      expect(cache.size).toBe(1000);
      expect(cache.get('new-key')).toBe('new-value');
      expect(cache.get('key0')).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.size).toBe(0);
    });

    it('should return correct count after additions', () => {
      cache.set('key1', 'value1', 10000);
      cache.set('key2', 'value2', 10000);
      expect(cache.size).toBe(2);
    });

    it('should reflect invalidation', () => {
      cache.set('123:partners:all', [], 10000);
      cache.set('123:sections:all', [], 10000);
      expect(cache.size).toBe(2);

      cache.invalidate('123:partners');
      expect(cache.size).toBe(1);
    });
  });

  describe('multi-company isolation', () => {
    it('should isolate cache entries by company ID', () => {
      cache.set('123:account_items:all', [{ id: 1 }], 10000);
      cache.set('456:account_items:all', [{ id: 2 }], 10000);

      expect(cache.get('123:account_items:all')).toEqual([{ id: 1 }]);
      expect(cache.get('456:account_items:all')).toEqual([{ id: 2 }]);
    });

    it('should invalidate only for specific company', () => {
      cache.set('123:partners:all', [{ id: 1 }], 10000);
      cache.set('456:partners:all', [{ id: 2 }], 10000);

      cache.invalidate('123:partners');

      expect(cache.get('123:partners:all')).toBeUndefined();
      expect(cache.get('456:partners:all')).toEqual([{ id: 2 }]);
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate key with "all" suffix when no params', () => {
    expect(generateCacheKey(123, 'sections')).toBe('123:sections:all');
  });

  it('should generate key with "all" suffix for undefined params', () => {
    expect(generateCacheKey(123, 'tags', undefined)).toBe('123:tags:all');
  });

  it('should generate key with "all" suffix when all param values are undefined', () => {
    expect(
      generateCacheKey(123, 'account_items', {
        account_category: undefined,
      }),
    ).toBe('123:account_items:all');
  });

  it('should generate hashed key when params have values', () => {
    const key = generateCacheKey(123, 'partners', { name: 'ABC Corp' });
    expect(key).toMatch(/^123:partners:[a-f0-9]{16}$/);
  });

  it('should generate consistent hash for same params', () => {
    const key1 = generateCacheKey(123, 'partners', { name: 'ABC' });
    const key2 = generateCacheKey(123, 'partners', { name: 'ABC' });
    expect(key1).toBe(key2);
  });

  it('should generate different hash for different params', () => {
    const key1 = generateCacheKey(123, 'partners', { name: 'ABC' });
    const key2 = generateCacheKey(123, 'partners', { name: 'XYZ' });
    expect(key1).not.toBe(key2);
  });

  it('should generate same hash regardless of param order', () => {
    const key1 = generateCacheKey(123, 'partners', {
      name: 'ABC',
      shortcut1: 'abc',
    });
    const key2 = generateCacheKey(123, 'partners', {
      shortcut1: 'abc',
      name: 'ABC',
    });
    expect(key1).toBe(key2);
  });

  it('should filter out undefined values from params', () => {
    const key1 = generateCacheKey(123, 'account_items', {
      account_category: 'income',
    });
    const key2 = generateCacheKey(123, 'account_items', {
      account_category: 'income',
      other: undefined,
    });
    expect(key1).toBe(key2);
  });

  it('should differentiate by company ID', () => {
    const key1 = generateCacheKey(123, 'sections');
    const key2 = generateCacheKey(456, 'sections');
    expect(key1).not.toBe(key2);
  });

  it('should differentiate by endpoint', () => {
    const key1 = generateCacheKey(123, 'sections');
    const key2 = generateCacheKey(123, 'tags');
    expect(key1).not.toBe(key2);
  });
});
