type InFlightEntry<T> = {
  promise: Promise<T>;
  createdAt: number;
};

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const inFlightRequests = new Map<string, InFlightEntry<any>>();
const dataCache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 30000; // 30 seconds

export async function fetchWithCache<T>(
  url: string,
  userId: string,
  options?: RequestInit & { ttl?: number }
): Promise<T> {
  const cacheKey = `${userId}:${url}`;
  const ttl = options?.ttl || DEFAULT_TTL;

  // 1. Check TTL Cache
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  // 2. Check In-Flight Requests
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight.promise;
  }

  // 3. Create new request
  // Clone the AbortSignal if provided, so we don't accidentally abort a shared promise for everyone
  // Actually, standard fetch doesn't support multiple signals cleanly.
  // We'll omit the signal from the actual fetch to prevent one component unmounting from aborting it for another.
  // Instead, the components can just ignore the result if they unmount.
  const { signal, ttl: _ttl, ...fetchOptions } = options || {};
  
  const promise = fetch(url, fetchOptions)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = await res.json();
      // Store in TTL cache
      dataCache.set(cacheKey, {
        data: json,
        timestamp: Date.now(),
      });
      return json as T;
    })
    .finally(() => {
      // Remove from in-flight requests once settled
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, {
    promise,
    createdAt: Date.now(),
  });

  return promise;
}

export function clearUserCache(userId: string) {
  for (const key of dataCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      dataCache.delete(key);
    }
  }
}
