import { baseEligible, canonicalize, eligibility, normalizeAnime, reliableDate } from './normalize.js';
import { createJikanClient, fetchAllPages, UpstreamError } from './jikan.js';

export async function loadAiring({ client = createJikanClient(), now = new Date() } = {}) {
  const current = await fetchAllPages(client, '/seasons/now?continuing=true&sfw=true');
  const cutoff = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const finished = await fetchAllPages(client, '/anime?status=complete&order_by=end_date&sort=desc&sfw=true', {
    stop(pageRows) {
      const dates = pageRows.map(item => reliableDate(item?.aired?.to)).filter(Boolean).map(Date.parse);
      return dates.length > 0 && dates.every(value => value < cutoff);
    }
  });
  const eligible = [...current, ...finished].filter(item => eligibility(item, now).eligible);
  const normalized = eligible.map(item => normalizeAnime(item, { now }));
  return canonicalize(normalized);
}

export async function loadSchedule({ client = createJikanClient(), now = new Date() } = {}) {
  const rows = await fetchAllPages(client, '/schedules?sfw=true');
  return canonicalize(rows.filter(baseEligible).map(item => normalizeAnime(item, { now }))).map(item => ({ ...item, rank: null }));
}

export async function loadDetail(id, { client = createJikanClient(), now = new Date(), aniNowRank = null } = {}) {
  const payload = await client.request(`/anime/${id}/full`);
  if (!payload.data || !eligibility(payload.data, now).eligible) throw new UpstreamError('This title is unavailable or outside AniNow’s eligibility window.', 404);
  const item = normalizeAnime(payload.data, { now, detail: true });
  item.aniNowRank = aniNowRank;
  return item;
}
