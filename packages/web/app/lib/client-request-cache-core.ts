
export class StaleRequestError extends Error {
  constructor(message = 'Request is stale') {
    super(message);
    this.name = 'StaleRequestError';
  }
}

export type RequestCacheOptions = {
  ttl?: number;
  forceRefresh?: boolean;
};

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  generation: number;
  lastAccessedAt: number;
};

type InFlightEntry<T> = {
  promise: Promise<T>;
  createdAt: number;
  generation: number;
};

const dataCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, InFlightEntry<any>>();
const keyGenerations = new Map<string, number>();
const activePromises = new Map<string, number>();

const DEFAULT_TTL = 30000;
const MAX_ENTRIES = 200;

function enforceMemoryLimit() {
  if (dataCache.size <= MAX_ENTRIES) return;
  const now = Date.now();
  let oldestKey: string | null = null;
  let oldestAccess = Infinity;
  
  // LRU / Expired Eviction (Bounded FIFO)
  for (const [key, entry] of dataCache.entries()) {
    if (entry.expiresAt < now) {
      dataCache.delete(key);
    } else if (entry.lastAccessedAt < oldestAccess) {
      oldestAccess = entry.lastAccessedAt;
      oldestKey = key;
    }
  }

  // If still over limit, delete oldest accessed
  if (dataCache.size > MAX_ENTRIES && oldestKey) {
    dataCache.delete(oldestKey);
  }
}

function getGeneration(key: string): number {
  return keyGenerations.get(key) || 0;
}

export async function fetchWithCache<T>(
  url: string,
  userScope: string,
  options?: RequestCacheOptions
): Promise<T> {
  const cacheKey = `${userScope}:GET:${url}`;
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const forceRefresh = options?.forceRefresh ?? false;
  const currentGen = getGeneration(cacheKey);
  const now = Date.now();

  // 1. Check TTL Cache if not force refreshing
  if (!forceRefresh) {
    const cached = dataCache.get(cacheKey);
    if (cached) {
      if (cached.expiresAt > now && cached.generation >= currentGen) {
        cached.lastAccessedAt = now;
        return cached.data as T;
      } else {
        dataCache.delete(cacheKey);
      }
    }
  }

  // 2. Check In-Flight Requests
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    // If it's a forceRefresh, we ONLY reuse if the inFlight was started exactly at currentGen (meaning it IS the force refresh).
    // If it's NOT a forceRefresh, we reuse if inFlight.generation is >= currentGen. If it's < currentGen, it's stale.
    if ((forceRefresh && inFlight.generation === currentGen) || (!forceRefresh && inFlight.generation >= currentGen)) {
      return inFlight.promise;
    }
  }

  // 3. Create new request
  const fetchPromise = fetch(url, { headers: { 'Cache-Control': 'no-store' } })
    .then(async (res) => {
      if (!res.ok) {
        // Try to parse error body if possible
        let errMsg = `Request failed with status ${res.status}`;
        try {
          const text = await res.text();
          if (text) {
             try {
               const errBody = JSON.parse(text);
               if (errBody?.message) errMsg = errBody.message;
               else if (errBody?.error) errMsg = errBody.error;
             } catch {
               errMsg = text;
             }
          }
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      
      // Handle 204 No Content
      if (res.status === 204) {
         return null as T;
      }

      const json = await res.json();
      
      // Before saving to cache, ensure it's not stale
      const latestGen = getGeneration(cacheKey);
      if (currentGen < latestGen) {
        throw new StaleRequestError();
      }

      dataCache.set(cacheKey, {
        data: json,
        expiresAt: Date.now() + ttl,
        generation: currentGen,
        lastAccessedAt: Date.now()
      });
      enforceMemoryLimit();
      return json as T;
    })
    .finally(() => {
      // Only delete if the in-flight request is exactly this one
      const currentInFlight = inFlightRequests.get(cacheKey);
      if (currentInFlight && currentInFlight.promise === fetchPromise) {
        inFlightRequests.delete(cacheKey);
      }
      
      const count = (activePromises.get(cacheKey) || 0) - 1;
      if (count <= 0) {
        activePromises.delete(cacheKey);
        if (!dataCache.has(cacheKey) && !inFlightRequests.has(cacheKey)) {
          keyGenerations.delete(cacheKey);
        }
      } else {
        activePromises.set(cacheKey, count);
      }
    });

  inFlightRequests.set(cacheKey, {
    promise: fetchPromise,
    createdAt: Date.now(),
    generation: currentGen
  });
  
  activePromises.set(cacheKey, (activePromises.get(cacheKey) || 0) + 1);

  return fetchPromise;
}

export function invalidateRequestCache(userScope: string, urlOrPrefix: string) {
  const prefix = `${userScope}:GET:${urlOrPrefix}`;
  
  // Track keys that need invalidation
  const keysToInvalidate = new Set<string>();
  
  // Add the exact prefix in case it's going to be queried later
  keysToInvalidate.add(prefix);
  
  for (const key of dataCache.keys()) {
    if (key.startsWith(prefix)) keysToInvalidate.add(key);
  }
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(prefix)) keysToInvalidate.add(key);
  }
  for (const key of keyGenerations.keys()) {
    if (key.startsWith(prefix)) keysToInvalidate.add(key);
  }

  for (const key of keysToInvalidate) {
    dataCache.delete(key);
    keyGenerations.set(key, getGeneration(key) + 1);
  }
}

export function clearUserRequestCache(userScope: string) {
  const prefix = `${userScope}:`;
  const keysToInvalidate = new Set<string>();
  
  for (const key of dataCache.keys()) {
    if (key.startsWith(prefix)) keysToInvalidate.add(key);
  }
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(prefix)) keysToInvalidate.add(key);
  }
  for (const key of keyGenerations.keys()) {
    if (key.startsWith(prefix)) keysToInvalidate.add(key);
  }

  for (const key of keysToInvalidate) {
    keyGenerations.set(key, getGeneration(key) + 1);
    dataCache.delete(key);
    inFlightRequests.delete(key);
    
    // Safety cleanup if no active promises
    if (!activePromises.has(key)) {
      keyGenerations.delete(key);
    }
  }
}

export function clearAllRequestCache() {
  const allKeys = new Set([
    ...dataCache.keys(),
    ...inFlightRequests.keys(),
    ...keyGenerations.keys()
  ]);
  
  for (const key of allKeys) {
    keyGenerations.set(key, getGeneration(key) + 1);
    dataCache.delete(key);
    inFlightRequests.delete(key);
    
    if (!activePromises.has(key)) {
      keyGenerations.delete(key);
    }
  }
}
