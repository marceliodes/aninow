import { cachedDataset } from '../_lib/cache.js';
import { developmentPayload, developmentSchedule } from '../_fixtures/dev-data.js';
import { isDevelopmentMockRequest } from '../_lib/development.js';
import { loadSchedule } from '../_lib/loaders.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet({ request, env = {} }) {
  if (isDevelopmentMockRequest(request, env)) return json(developmentPayload(developmentSchedule()), 200, 'no-store');
  try { return json(await cachedDataset({ request, name: 'schedule', loader: () => loadSchedule() })); }
  catch (error) { return errorResponse(error); }
}
