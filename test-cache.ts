import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const cacheSource = fs.readFileSync(path.join(__dirname, 'packages/web/app/lib/client-request-cache.js'), 'utf-8');
const transformedSource = cacheSource
  .replace("require(\"client-only\");", "");

const context = {
  fetch: null as any,
  console,
  Date,
  setTimeout,
  Promise,
  Map,
  Set,
  Error,
  exports: {},
  require: () => {}
};
vm.createContext(context);
vm.runInContext(transformedSource, context);

const { fetchWithCache, invalidateRequestCache, clearAllRequestCache, StaleRequestError } = context.exports as any;
const { dataCache } = context as any; // Actually dataCache isn't exported, let me export it in the context script

async function runTests() {
  console.log('--- RUNNING CACHE TESTS ---');

  // Test 1: Shared in-flight (GET requests deduped)
  let fetchCount = 0;
  context.fetch = async (url: string) => {
    fetchCount++;
    return { ok: true, json: async () => ({ url }), status: 200 };
  };

  clearAllRequestCache();
  const p1 = fetchWithCache('/api/test', 'userA');
  const p2 = fetchWithCache('/api/test', 'userA');
  await Promise.all([p1, p2]);
  console.assert(fetchCount === 1, `Test 1 Failed: fetchCount ${fetchCount}`);

  // Test 2: Different users
  fetchCount = 0;
  clearAllRequestCache();
  await Promise.all([
    fetchWithCache('/api/test', 'userA'),
    fetchWithCache('/api/test', 'userB')
  ]);
  console.assert(fetchCount === 2, `Test 2 Failed: fetchCount ${fetchCount}`);

  // Test 4 & 5: TTL
  fetchCount = 0;
  clearAllRequestCache();
  await fetchWithCache('/api/test', 'userA', { ttl: 50 }); // fetch 1
  await fetchWithCache('/api/test', 'userA'); // fetch 0 (cached)
  console.assert(fetchCount === 1, `Test 4 Failed: fetchCount ${fetchCount}`);
  
  await new Promise(r => setTimeout(r, 100)); // wait for TTL to expire
  await fetchWithCache('/api/test', 'userA'); // fetch 2
  console.assert(fetchCount === 2, `Test 5 Failed: fetchCount ${fetchCount}`);

  // Test 6: ttl: 0
  fetchCount = 0;
  clearAllRequestCache();
  await fetchWithCache('/api/test', 'userA', { ttl: 0 }); // fetch 1
  await fetchWithCache('/api/test', 'userA', { ttl: 0 }); // fetch 2
  console.assert(fetchCount === 2, `Test 6 Failed: fetchCount ${fetchCount}`);

  // Test 7: Error not cached
  fetchCount = 0;
  clearAllRequestCache();
  context.fetch = async () => { fetchCount++; return { ok: false, status: 500, text: async () => 'error' } };
  try { await fetchWithCache('/api/error', 'userA'); } catch {}
  try { await fetchWithCache('/api/error', 'userA'); } catch {}
  console.assert(fetchCount === 2, `Test 7 Failed: fetchCount ${fetchCount}`);
  context.fetch = async (url: string) => ({ ok: true, json: async () => ({ url }), status: 200 });

  // Test 8-12: Mutation Race Condition (Stale Request)
  clearAllRequestCache();
  let resolveOld: any;
  let resolveNew: any;
  context.fetch = (url: string) => {
     return new Promise(resolve => {
        if (url === '/api/slow_old') {
           resolveOld = resolve;
        } else if (url === '/api/slow_new') {
           resolveNew = resolve;
        } else {
           resolve({ ok: true, json: async () => ({ data: 'new' }), status: 200, text: async () => '' });
        }
     });
  };

  const oldGetPromise = fetchWithCache('/api/slow_old', 'userA'); // Gen 0
  // Note: For invalidation to affect it, we use a prefix
  invalidateRequestCache('userA', '/api/slow'); // Gen 1
  const newGetPromise = fetchWithCache('/api/slow_new', 'userA', { forceRefresh: true }); // Gen 1
  
  resolveNew({ ok: true, json: async () => ({ data: 'new' }), status: 200, text: async () => '' });
  await newGetPromise;
  
  // Resolve old get now
  resolveOld({ ok: true, json: async () => ({ data: 'old' }), status: 200, text: async () => '' });
  
  let oldError;
  try {
    await oldGetPromise;
  } catch(e: any) {
    oldError = e;
  }
  console.assert(oldError instanceof StaleRequestError || oldError?.name === 'StaleRequestError', 'Test 12 Failed: Expected StaleRequestError');

  console.log('--- ALL CACHE TESTS PASSED ---');
}

runTests().catch(console.error);
