import { 
  fetchWithCache, 
  invalidateRequestCache, 
  clearUserRequestCache, 
  clearAllRequestCache, 
  StaleRequestError 
} from '../client-request-cache-core';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log('--- RUNNING CACHE TESTS ---');

  // Test 1: Race cùng một URL
  console.log('Testing: Race cùng một URL');
  clearAllRequestCache();

  let fetchCallCount = 0;
  let resolveOldRequest!: (value: Response) => void;
  let resolveNewRequest!: (value: Response) => void;

  globalThis.fetch = (() => {
    fetchCallCount += 1;
    return new Promise<Response>((resolve) => {
      if (fetchCallCount === 1) {
        resolveOldRequest = resolve;
      } else if (fetchCallCount === 2) {
        resolveNewRequest = resolve;
      } else {
        throw new Error(`Unexpected fetch call: ${fetchCallCount}`);
      }
    });
  }) as typeof fetch;

  const oldRequest = fetchWithCache('/api/appeals', 'userA'); // Gen 0
  
  invalidateRequestCache('userA', '/api/appeals'); // Gen 1
  
  const newRequest = fetchWithCache('/api/appeals', 'userA', { forceRefresh: true }); // Gen 1

  // Resolve request mới trước với dữ liệu NEW
  resolveNewRequest({ ok: true, json: async () => ({ data: 'NEW' }), status: 200, text: async () => '' } as any);
  const newData = await newRequest as any;
  assert(newData.data === 'NEW', 'Test Race Failed: Expected NEW data');

  // Resolve request cũ sau với dữ liệu OLD
  resolveOldRequest({ ok: true, json: async () => ({ data: 'OLD' }), status: 200, text: async () => '' } as any);
  
  let oldError;
  try {
    await oldRequest;
  } catch(e: any) {
    oldError = e;
  }
  
  assert(oldError instanceof StaleRequestError || oldError?.name === 'StaleRequestError', 'Test Race Failed: Expected StaleRequestError from old request');

  // Gọi lại cùng URL trong TTL
  const cachedRequest = fetchWithCache('/api/appeals', 'userA');
  const cachedData = await cachedRequest as any;
  assert(cachedData.data === 'NEW', 'Test Race Failed: Cache does not contain NEW');
  
  // Xác nhận tổng số lần gọi fetch đúng bằng 2
  assert(fetchCallCount === 2, `Test Race Failed: fetchCallCount should be 2, but was ${fetchCallCount}`);

  console.log('Test Race Passed!');

  // Test 2: Clear user khi request đang in-flight
  console.log('Testing: Clear user khi request đang in-flight');
  clearAllRequestCache();

  let resolveUserA!: (value: Response) => void;
  let clearUserFetchCount = 0;
  globalThis.fetch = (() => {
    clearUserFetchCount += 1;
    return new Promise<Response>((resolve) => {
      resolveUserA = resolve;
    });
  }) as typeof fetch;

  const userAPromise = fetchWithCache('/api/notifications', 'userA'); // Gen 0
  clearUserRequestCache('userA'); // Generation bumped to 1
  
  resolveUserA({ ok: true, json: async () => ({ data: 'stale_data' }), status: 200, text: async () => '' } as any);
  
  let userAError;
  try {
    await userAPromise;
  } catch(e: any) {
    userAError = e;
  }
  
  assert(userAError instanceof StaleRequestError || userAError?.name === 'StaleRequestError', 'Test Clear Failed: Expected StaleRequestError from userA');
  
  // Request tiếp theo của user A phải gọi fetch mới
  const userANewPromise = fetchWithCache('/api/notifications', 'userA');
  assert(clearUserFetchCount === 2, `Test Clear Failed: Expected clearUserFetchCount to be 2, but was ${clearUserFetchCount}`);

  console.log('Test Clear Passed!');

  console.log('ALL CACHE TESTS PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
