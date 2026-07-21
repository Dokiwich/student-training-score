import * as vm from 'vm';

// Mock `client-only` since it throws in Node.js outside React
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === 'client-only') return {};
  return originalRequire.apply(this, arguments as any);
};

// Now import the real module
import { 
  fetchWithCache, 
  invalidateRequestCache, 
  clearUserRequestCache, 
  clearAllRequestCache, 
  StaleRequestError 
} from '../client-request-cache';

async function runTests() {
  console.log('--- RUNNING CACHE TESTS ---');

  // Test 1: Shared in-flight (GET requests deduped)
  let fetchCount = 0;
  globalThis.fetch = async (url: string | URL | Request) => {
    fetchCount++;
    return { ok: true, json: async () => ({ url }), status: 200 } as Response;
  };

  clearAllRequestCache();
  const p1 = fetchWithCache('/api/test', 'userA');
  const p2 = fetchWithCache('/api/test', 'userA');
  await Promise.all([p1, p2]);
  console.assert(fetchCount === 1, `Test 1 Failed: fetchCount ${fetchCount}`);

  // Test Race cùng URL
  clearAllRequestCache();
  let resolveOld: any;
  let resolveNew: any;
  globalThis.fetch = ((url: string) => {
     return new Promise(resolve => {
        if (url === '/api/appeals_old') {
           resolveOld = resolve;
        } else if (url === '/api/appeals_new') {
           resolveNew = resolve;
        } else {
           resolve({ ok: true, json: async () => ({ data: 'new' }), status: 200, text: async () => '' });
        }
     });
  }) as any;

  console.log('Testing: Race cùng một URL');
  const oldGetPromise = fetchWithCache('/api/appeals_old', 'userA'); // Gen 0
  invalidateRequestCache('userA', '/api/appeals'); // Gen 1
  const newGetPromise = fetchWithCache('/api/appeals_new', 'userA', { forceRefresh: true }); // Gen 1
  
  resolveNew({ ok: true, json: async () => ({ data: 'new_data' }), status: 200, text: async () => '' });
  const newData = await newGetPromise as any;
  console.assert(newData.data === 'new_data', 'Test Race Failed: Expected new_data');

  // Resolve old get now
  resolveOld({ ok: true, json: async () => ({ data: 'old_data' }), status: 200, text: async () => '' });
  
  let oldError;
  try {
    await oldGetPromise;
  } catch(e: any) {
    oldError = e;
  }
  console.assert(oldError instanceof StaleRequestError || oldError?.name === 'StaleRequestError', 'Test Race Failed: Expected StaleRequestError');
  console.log('Test Race Passed!');

  // Test Clear user khi request đang chạy
  clearAllRequestCache();
  let resolveUserA: any;
  globalThis.fetch = ((url: string) => {
     return new Promise(resolve => {
        resolveUserA = resolve;
     });
  }) as any;

  console.log('Testing: Clear user khi request đang chạy');
  const userAPromise = fetchWithCache('/api/notifications', 'userA'); // Gen 0
  clearUserRequestCache('userA'); // Generation bumped to 1
  
  resolveUserA({ ok: true, json: async () => ({ data: 'stale_data' }), status: 200, text: async () => '' });
  
  let userAError;
  try {
    await userAPromise;
  } catch(e: any) {
    userAError = e;
  }
  console.assert(userAError instanceof StaleRequestError || userAError?.name === 'StaleRequestError', 'Test Clear Failed: Expected StaleRequestError');
  console.log('Test Clear Passed!');

  console.log('--- ALL CACHE TESTS PASSED ---');
}

runTests().catch(console.error);
