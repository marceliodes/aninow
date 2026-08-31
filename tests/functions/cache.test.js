import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedDataset, clearInflightForTests, FRESH_MS, RETRY_MS, STALE_MS } from '../../functions/_lib/cache.js';

class MemoryCache {
  constructor(now) { this.items = new Map(); this.now = now; }
  async match(request) { const item = this.items.get(request.url); return item && item.expires > this.now() ? item.response.clone() : undefined; }
  async put(request, response) { const ttl = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control'))?.[1] || 0) * 1000; this.items.set(request.url, { response: response.clone(), expires: this.now() + ttl }); }
}

test('cache hits avoid loaders and simultaneous misses deduplicate', async () => {
  clearInflightForTests(); let clock = 0; const cache = new MemoryCache(() => clock); let calls = 0;
  const args = { request: new Request('https://aninow.test/api/airing'), name: 'airing', cache, now: () => clock, loader: async () => { calls += 1; await Promise.resolve(); return [calls]; } };
  const [a,b] = await Promise.all([cachedDataset(args), cachedDataset(args)]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  await cachedDataset(args); assert.equal(calls, 1);
});

test('failed refresh serves last success stale and suppresses retries for five minutes', async () => {
  clearInflightForTests(); let clock = 0; const cache = new MemoryCache(() => clock); let calls = 0;
  const request = new Request('https://aninow.test/api/airing');
  await cachedDataset({ request, name: 'airing', cache, now: () => clock, loader: async () => ['good'] });
  clock = FRESH_MS + 1;
  const broken = { request, name: 'airing', cache, now: () => clock, loader: async () => { calls += 1; throw new Error('nope'); } };
  const stale = await cachedDataset(broken);
  assert.equal(stale.meta.stale, true); assert.deepEqual(stale.data, ['good']); assert.equal(calls, 1);
  await cachedDataset(broken); assert.equal(calls, 1);
  clock += RETRY_MS + 1; await cachedDataset(broken); assert.equal(calls, 2);
});

test('expired 24-hour fallback never publishes partial or stale data', async () => {
  clearInflightForTests(); let clock = 0; const cache = new MemoryCache(() => clock); const request = new Request('https://aninow.test/api/schedule');
  await cachedDataset({ request, name: 'schedule', cache, now: () => clock, loader: async () => ['whole'] });
  clock = STALE_MS + 1;
  await assert.rejects(cachedDataset({ request, name: 'schedule', cache, now: () => clock, loader: async () => { throw new Error('failed'); } }), /failed/);
});

test('failed refresh without stale data is also suppressed for five minutes', async () => {
  clearInflightForTests(); let clock = 0; const cache = new MemoryCache(() => clock); const request = new Request('https://aninow.test/api/empty'); let calls = 0;
  const args = { request, name: 'empty', cache, now: () => clock, loader: async () => { calls += 1; throw Object.assign(new Error('upstream down'), { status: 502 }); } };
  await assert.rejects(cachedDataset(args), /upstream down/);
  await assert.rejects(cachedDataset(args), /upstream down/);
  assert.equal(calls, 1);
});
