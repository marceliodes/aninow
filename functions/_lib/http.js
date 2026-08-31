export function json(payload, status = 200, cacheControl = status === 200 ? 'public, max-age=60' : 'no-store') {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl } });
}

export function errorResponse(error) {
  const status = [400, 404, 502, 503].includes(error?.status) ? error.status : 502;
  const code = status === 400 ? 'INVALID_ID' : status === 404 ? 'NOT_FOUND' : status === 503 ? 'UPSTREAM_UNAVAILABLE' : 'UPSTREAM_ERROR';
  return json({ error: { code, message: error?.message || 'AniNow could not load data right now.', retryable: status >= 500 } }, status);
}
