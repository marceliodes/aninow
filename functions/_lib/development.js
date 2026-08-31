const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isDevelopmentMockRequest(request, env = {}) {
  if (String(env.ANINOW_DEV_MOCK) !== '1' || String(env.CF_PAGES_BRANCH) !== 'local') return false;
  try { return LOCAL_HOSTNAMES.has(new URL(request.url).hostname); }
  catch { return false; }
}
