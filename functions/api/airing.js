import { cachedDataset } from '../_lib/cache.js';
import { enrichWithNextAirings } from '../_lib/airing-enrichment.js';
import { developmentAiring, developmentPayload } from '../_fixtures/dev-data.js';
import { isDevelopmentMockRequest } from '../_lib/development.js';
import { loadAiring } from '../_lib/loaders.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet({ request, env = {} }) {
  if (isDevelopmentMockRequest(request, env)) return json(developmentPayload(developmentAiring()), 200, 'no-store');
  try {
    const payload = await cachedDataset({ request, name: 'airing', loader: () => loadAiring({ clientId: env.MAL_CLIENT_ID }) });
    return json({ ...payload, data: await enrichWithNextAirings(payload.data, { request }) });
  }
  catch (error) { return errorResponse(error); }
}
