export const rawAnime = (overrides = {}) => ({
  id: 1,
  title: 'Romaji One',
  alternative_titles: { en: 'English One', ja: '日本語一' },
  main_picture: { large: 'https://cdn.myanimelist.net/images/anime/1/1.webp' },
  mean: 8.5,
  num_scoring_users: 1200,
  popularity: 100,
  num_list_users: 50000,
  media_type: 'tv',
  status: 'currently_airing',
  num_episodes: 12,
  start_date: '2026-07-01',
  end_date: null,
  broadcast: { day_of_the_week: 'friday', start_time: '23:30' },
  studios: [{ id: 10, name: 'Signal Works' }],
  genres: [{ id: 8, name: 'Drama' }],
  nsfw: 'white',
  rating: 'pg_13',
  synopsis: 'A precise fixture synopsis.',
  start_season: { season: 'summer', year: 2026 },
  ...overrides
});

export const malList = (nodes, next = null) => ({
  data: nodes.map((node, index) => ({ node, ranking: { rank: index + 1 } })),
  paging: next ? { next } : {}
});

export const normalizedAnime = (overrides = {}) => ({
  malId: 1, title: 'English One', titleRomaji: 'Romaji One', image: 'https://cdn.myanimelist.net/images/anime/1/1.webp', rank: 1,
  score: 8.5, scoredBy: 1200, popularity: 100, members: 50000, type: 'TV', studio: 'Signal Works', studios: ['Signal Works'], episodes: 12,
  status: 'Currently Airing', airing: true, airedFrom: '2026-07-01T00:00:00.000Z', airedTo: null, broadcastDay: 'Fridays', broadcastTime: '23:30', broadcastTimezone: 'Asia/Tokyo', genres: ['Drama'], malUrl: 'https://myanimelist.net/anime/1', graceEndsAt: null,
  ...overrides
});

export const meta = { updatedAt: '2026-08-30T10:00:00.000Z', expiresAt: '2026-08-30T10:30:00.000Z', stale: false };
