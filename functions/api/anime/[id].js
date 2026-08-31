import { cachedDataset, readLastSuccess } from '../../_lib/cache.js';
import { developmentDetail, developmentPayload } from '../../_fixtures/dev-data.js';
import { isDevelopmentMockRequest } from '../../_lib/development.js';
import { loadDetail } from '../../_lib/loaders.js';
import { errorResponse, json } from '../../_lib/http.js';

export async function onRequestGet({ request, params, env = {} }) {
  if (!/^[1-9]\d*$/.test(String(params.id))) return errorResponse(Object.assign(new Error('Anime ID must be a positive integer.'), { status: 400 }));
  const id = Number(params.id);
  if (isDevelopmentMockRequest(request, env)) {
    const detail = developmentDetail(id);
    return detail
      ? json(developmentPayload(detail), 200, 'no-store')
      : errorResponse(Object.assign(new Error('This fixture anime was not found.'), { status: 404 }));
  }
  try {
    const cachedAiring = await readLastSuccess('airing', request);
    const rank = cachedAiring?.data?.find(item => item.malId === id)?.rank ?? null;
    return json(await cachedDataset({ request, name: `anime-${id}`, loader: () => loadDetail(id, { clientId: env.MAL_CLIENT_ID, aniNowRank: rank }) }));
  } catch (error) { return errorResponse(error); }
}
