import { cachedDataset } from '../_lib/cache.js';
import { developmentPayload, developmentSchedule } from '../_fixtures/dev-data.js';
import { isDevelopmentMockRequest } from '../_lib/development.js';
import { loadAiring, projectSchedule } from '../_lib/loaders.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet({ request, env = {} }) {
  if (isDevelopmentMockRequest(request, env)) return json(developmentPayload(developmentSchedule()), 200, 'no-store');
  try {
    const payload = await cachedDataset({ request, name: 'airing', loader: () => loadAiring({ clientId: env.MAL_CLIENT_ID }) });
    return json({ data: projectSchedule(payload.data), meta: payload.meta });
  }
  catch (error) { return errorResponse(error); }
}
