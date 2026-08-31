import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as detailEndpoint } from '../../functions/api/anime/[id].js';
import { errorResponse } from '../../functions/_lib/http.js';

test('detail endpoint rejects invalid IDs without contacting upstream', async () => {
  const response = await detailEndpoint({ request: new Request('https://aninow.test/api/anime/nope'), params: { id: '-1' } });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_ID', message: 'Anime ID must be a positive integer.', retryable: false } });
});

test('structured upstream errors distinguish retryable and missing resources', async () => {
  const missing = errorResponse(Object.assign(new Error('Missing'), { status: 404 }));
  assert.equal((await missing.json()).error.retryable, false);
  const failed = errorResponse(Object.assign(new Error('Unavailable'), { status: 503 }));
  assert.equal((await failed.json()).error.retryable, true);
});
