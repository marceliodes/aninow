import { cachedDataset } from '../_lib/cache.js';
import { developmentAiring, developmentPayload } from '../_fixtures/dev-data.js';
import { isDevelopmentMockRequest } from '../_lib/development.js';
import { loadAiring } from '../_lib/loaders.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet({ request, env = {} }) {
  if (isDevelopmentMockRequest(request, env)) return json(developmentPayload(developmentAiring()), 200, 'no-store');
  try { return json(await cachedDataset({ request, name: 'airing', loader: () => loadAiring() })); }
  catch (error) { return errorResponse(error); }
}
