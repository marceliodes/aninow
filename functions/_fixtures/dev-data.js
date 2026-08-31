const COVER_PLACEHOLDER = 'https://cdn.myanimelist.net/images/questionmark_50.gif';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const FRESH_MS = 30 * 60 * 1000;

const TITLES = [
  ['Scarlet Orbit', 'Akaki Kidou'],
  ['Paper Moon Alchemist', 'Kami no Tsuki no Renkinjutsushi'],
  ['Neon Shrine Runners', 'Neon Jinja Runners'],
  ['After-School Kaiju Club', 'Houkago Kaijuu Club'],
  ['Echoes of the Sun Gate', 'Taiyoumon no Zankyou'],
  ['Celestial Bento Express', 'Tenkuu Bentou Express'],
  ['The Last Sky Librarian', 'Saigo no Sora Shisho'],
  ['Yokai Radio Midnight', 'Youkai Radio Midnight'],
  ['Iron Lotus Brigade', 'Tetsu no Renge Ryodan'],
  ['Rainy Season Detectives', 'Tsuyu no Tanteitachi'],
  ['Starboard Academy', 'Starboard Gakuen'],
  ['Moonlit Mecha Workshop', 'Gekka Mecha Koubou'],
  ['Foxfire on Platform Nine', 'Kyuuban Home no Kitsunebi'],
  ['Parallel Summer', 'Heikou Natsu'],
  ['Cloud City Apothecary', 'Kumonomiyako no Kusurishi'],
  ['Midnight Ramen Vanguard', 'Mayonaka Ramen Sentai'],
  ['The Clockwork Tanuki', 'Karakuri Tanuki'],
  ['North Wind Symphony', 'Kitakaze Symphony'],
  ['Garden of Falling Stars', 'Hoshifuru Niwa'],
  ['Signal from the Deep', 'Shinkai kara no Signal'],
  ['Lanterns Beyond Tomorrow', 'Ashita no Saki no Chouchin'],
  ['Turbo Witch Delivery', 'Mahoutsukai Turbo Takkyuubin'],
  ['Memory Arcade 1999', 'Kioku Arcade 1999'],
  ['Silver Current', 'Gin no Nagare'],
  ['Café at the Edge of Space', 'Uchuu no Hate no Kissaten'],
  ['The Quiet Thunder', 'Shizukana Kaminari'],
  ['Pocket Dimension Patrol', 'Pocket Jigen Patrol']
];

const UNRANKED = [
  ['Comet Post Office', 'Suisei Yuubinkyoku'],
  ['Maple Street Spirits', 'Kaede Doori no Seirei'],
  ['Zero-G Gardening Club', 'Mujuuryoku Engeibu']
];

const STUDIOS = ['Signal Works', 'Northstar Animation', 'Studio Lantern', 'Kite Frame', 'Blue Hour Pictures', 'Mikan Lab'];
const DAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const TIMES = ['18:00', '19:30', '21:00', '22:00', '23:00', '23:30', '00:30'];
const GENRES = [
  ['Action', 'Sci-Fi'], ['Adventure', 'Fantasy'], ['Comedy', 'Supernatural'], ['Drama', 'School'],
  ['Mystery', 'Fantasy'], ['Comedy', 'Gourmet'], ['Adventure', 'Drama'], ['Supernatural', 'Mystery']
];

const iso = value => new Date(value).toISOString();

function buildSummary([title, titleRomaji], index, now, unranked = false) {
  const malId = 900001 + index;
  const type = index % 7 === 0 ? 'OVA' : index % 4 === 0 ? 'ONA' : 'TV';
  const finishedOffset = index === 6 ? 3 : index === 22 ? 10 : null;
  const finished = finishedOffset !== null;
  const airedToTime = finished ? now - finishedOffset * DAY : null;
  const score = unranked ? null : Number((9.31 - index * 0.09).toFixed(2));
  return {
    malId,
    title,
    titleRomaji,
    image: COVER_PLACEHOLDER,
    rank: unranked ? null : index + 1,
    score,
    scoredBy: unranked ? null : 68420 - index * 1731,
    popularity: unranked ? 2400 + index : 80 + ((index * 173) % 1350),
    members: unranked ? 1800 + index * 90 : 188000 - index * 4937,
    type,
    studio: STUDIOS[index % STUDIOS.length],
    studios: [STUDIOS[index % STUDIOS.length]],
    episodes: type === 'OVA' ? 4 : type === 'ONA' ? 10 : index % 5 === 0 ? 24 : 12,
    status: finished ? 'Finished Airing' : 'Currently Airing',
    airing: !finished,
    airedFrom: iso(now - (18 + index * 4) * DAY),
    airedTo: finished ? iso(airedToTime) : null,
    broadcastDay: index === 25 ? null : DAYS[index % DAYS.length],
    broadcastTime: index % 9 === 0 ? null : TIMES[index % TIMES.length],
    broadcastTimezone: 'Asia/Tokyo',
    genres: GENRES[index % GENRES.length],
    malUrl: null,
    graceEndsAt: finished ? iso(airedToTime + 14 * DAY) : null
  };
}

export function developmentAiring(now = Date.now()) {
  const ranked = TITLES.map((title, index) => buildSummary(title, index, now));
  const unranked = UNRANKED.map((title, offset) => buildSummary(title, TITLES.length + offset, now, true))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...ranked, ...unranked];
}

export function developmentSchedule(now = Date.now()) {
  return developmentAiring(now)
    .filter(item => item.airing)
    .map(item => ({ ...item, rank: null }));
}

export function developmentDetail(id, now = Date.now()) {
  const summary = developmentAiring(now).find(item => item.malId === id);
  if (!summary) return null;
  return {
    ...summary,
    synopsis: `${summary.title} follows a small group of unlikely allies through a changing weekly adventure. This fictional synopsis is development fixture content used to exercise AniNow while the live upstream is unavailable.`,
    season: 'summer',
    year: new Date(now).getUTCFullYear(),
    aniNowRank: summary.rank
  };
}

export function developmentPayload(data, now = Date.now()) {
  return {
    data,
    meta: {
      updatedAt: iso(now),
      expiresAt: iso(now + FRESH_MS),
      stale: false
    }
  };
}
