import { canonicalize, eligibility, normalizeAnime } from './normalize.js';
import { createMalClient, fetchAllPages, UpstreamError } from './mal.js';

export const SUMMARY_FIELDS = [
  'id', 'title', 'main_picture', 'alternative_titles', 'start_date', 'end_date',
  'mean', 'popularity', 'num_list_users', 'num_scoring_users', 'media_type',
  'status', 'genres', 'num_episodes', 'broadcast', 'studios', 'nsfw', 'rating'
].join(',');
export const DETAIL_FIELDS = `${SUMMARY_FIELDS},synopsis,start_season`;
const SEASONS = ['winter', 'spring', 'summer', 'fall'];

export function currentAndPreviousSeasons(now = new Date()) {
  const currentIndex = Math.floor(now.getUTCMonth() / 3);
  const current = { year: now.getUTCFullYear(), season: SEASONS[currentIndex] };
  const previousIndex = (currentIndex + 3) % 4;
  const previous = { year: current.year - (currentIndex === 0 ? 1 : 0), season: SEASONS[previousIndex] };
  return [current, previous];
}

const listPath = (path, params) => `${path}?${new URLSearchParams(params)}`;

export async function loadAiring({ client, clientId, now = new Date() } = {}) {
  const mal = client || createMalClient({ clientId });
  const [currentSeason, previousSeason] = currentAndPreviousSeasons(now);
  const [ranking, current, previous] = await Promise.all([
    fetchAllPages(mal, listPath('/anime/ranking', { ranking_type: 'airing', fields: SUMMARY_FIELDS })),
    fetchAllPages(mal, listPath(`/anime/season/${currentSeason.year}/${currentSeason.season}`, { fields: SUMMARY_FIELDS })),
    fetchAllPages(mal, listPath(`/anime/season/${previousSeason.year}/${previousSeason.season}`, { fields: SUMMARY_FIELDS }))
  ]);
  const ranked = ranking.filter(anime => anime.status === 'currently_airing' && eligibility(anime, now).eligible);
  const recentlyFinished = [...current, ...previous].filter(anime => anime.status === 'finished_airing' && eligibility(anime, now).eligible);
  const merged = new Map();
  for (const anime of recentlyFinished) if (!merged.has(anime.id)) merged.set(anime.id, anime);
  for (const anime of ranked) merged.set(anime.id, anime);
  return canonicalize([...merged.values()].map(anime => normalizeAnime(anime, { now })));
}

export function projectSchedule(items) { return items.map(item => ({ ...item, rank: null })); }

export async function loadSchedule(options = {}) { return projectSchedule(await loadAiring(options)); }

export async function loadDetail(id, { client, clientId, now = new Date(), aniNowRank = null } = {}) {
  const mal = client || createMalClient({ clientId });
  const payload = await mal.request(`/anime/${id}?${new URLSearchParams({ fields: DETAIL_FIELDS })}`);
  if (!Number.isInteger(payload.id) || !eligibility(payload, now).eligible) throw new UpstreamError('This title is unavailable or outside AniNow’s eligibility window.', 404);
  const item = normalizeAnime(payload, { now, detail: true });
  item.aniNowRank = aniNowRank;
  return item;
}
