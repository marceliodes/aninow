import { cachedDataset } from '../_lib/cache.js';
import { enrichWithNextAirings } from '../_lib/airing-enrichment.js';
import { developmentPayload, developmentSchedule } from '../_fixtures/dev-data.js';
import { isDevelopmentMockRequest } from '../_lib/development.js';
import { loadAiring, projectSchedule } from '../_lib/loaders.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet({ request, env = {} }) {
  if (isDevelopmentMockRequest(request, env)) return json(developmentPayload(developmentSchedule()), 200, 'no-store');
  try {
    const payload = await cachedDataset({ request, name: 'airing', loader: () => loadAiring({ clientId: env.MAL_CLIENT_ID }) });
    const enriched = await enrichWithNextAirings(payload.data, { request });
    return json({ data: projectSchedule(enriched), meta: payload.meta });
  }
  catch (error) { return errorResponse(error); }
}
