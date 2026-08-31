# PRD.md — AniNow

## Product
AniNow is an open-source anime discovery website answering:

> **What's airing? See who's on top.**

AniNow ranks eligible **currently airing TV anime** by MyAnimeList score, keeps recently finished eligible TV titles in the same leaderboard for a 14-day grace period, and provides a weekly airing schedule.

Data comes directly from the **official MyAnimeList API v2** through AniNow's Cloudflare serverless layer.

AniNow is intended to remain useful beyond its portfolio role.

## Goals
- Current, scan-friendly TV-anime leaderboard.
- MAL score is the default ranking.
- Display number of scoring users.
- Keep recently finished TV anime for 14 days in the same ranking.
- Keep eligible unrated TV anime under **Not Ranked Yet**.
- Genre/day filters, sorting, and in-dataset search.
- Weekly schedule generated from the same eligible dataset.
- Dynamic anime detail pages.
- ~30-minute freshness/cache cadence.
- Last-known-good resilience during upstream outages.
- Fast, accessible, responsive, maintainable, open-source implementation.

## Non-goals
No accounts, MAL login/OAuth, watchlists, comments, AniNow ratings, streaming/piracy links, persistent favorites, global MAL search, movie rankings, ONA/OVA rankings, or recommendation engine.

## Upstream provider
AniNow V1 uses the **official MyAnimeList API v2** as its sole production anime-data provider.

Do not silently add Jikan, scraping, AniList, Kitsu, or another provider as fallback.

## Authentication
Cloudflare authenticates MAL requests using server-side:
```text
MAL_CLIENT_ID
```

The browser never receives this credential.

Local development uses `.dev.vars`, which remains gitignored.

Production uses Cloudflare environment configuration/secrets.

The MAL Client Secret is not required for V1's public read-only API usage unless future authenticated/OAuth functionality explicitly requires it.

## Architecture
```text
Browser
  ↓
Cloudflare Pages frontend
  ↓ /api/...
Cloudflare Pages Function / Worker
  ↓
fresh AniNow cache?
  ├─ yes → normalized cached JSON
  └─ no
       ↓
Official MyAnimeList API v2
       ↓
normalize + eligibility/business rules
       ↓
cache + last-known-good snapshot
       ↓
frontend
```

Frontend consumes AniNow's normalized API, not raw MAL responses.

## Refresh and resilience
Preserve:
- ~30-minute fresh cache;
- ~24-hour last-known-good data;
- failed-refresh suppression/backoff;
- concurrent refresh deduplication where practical;
- stale metadata;
- non-destructive refresh failure when valid content is already rendered;
- full error state only when no usable data exists.

UI shows last successful update, `mm:ss` countdown, stale/failure status where applicable, and Refresh.

Manual Refresh respects backend cache and must not force repeated MAL requests.

"Live/current" means periodically refreshed, not second-by-second real-time MAL updates.

## Eligibility
Include only:
```text
media_type === "tv"
```

and either:
```text
status === "currently_airing"
```

or:
```text
status === "finished_airing"
AND reliable end_date is within the last 14 days
```

Long-running TV anime remain eligible while MAL marks them currently airing.

Exclude ONA, OVA, movies, specials/other non-TV types, explicit adult/Hentai/Rx entries, and entries outside the current/recently-finished lifecycle.

Ordinary mature/ecchi TV anime are not automatically excluded solely for mature themes.

## Current-airing discovery
Use the official MAL anime ranking endpoint with:
```text
ranking_type=airing
```

Paginate as needed.

Request required fields directly with MAL's `fields=` parameter wherever supported.

Then:
1. keep `media_type === "tv"`;
2. keep entries identified as currently airing;
3. normalize into AniNow's internal shape;
4. deduplicate by MAL ID.

Avoid one detail request per leaderboard item.

## Recently finished discovery
Use official MAL seasonal data for:
- current season;
- immediately previous season.

Keep candidates where:
- `media_type === "tv"`;
- `status === "finished_airing"`;
- reliable `end_date` exists;
- `end_date` is within 14 days;
- MAL ID is not already present.

Merge them into the same leaderboard and deduplicate by MAL ID.

If real MAL behavior proves current+previous season insufficient for the 14-day rule, extend the candidate strategy deliberately rather than guessing.

## Ranking
Default order:
```text
MAL mean score descending
```

Normalize:
```text
mean → score
num_scoring_users → scoredBy
```

Use MAL's supplied weighting as-is.

No custom minimum-vote threshold and no custom rating formula.

Stable score tie-break:
1. greater `scoredBy`;
2. title alphabetically.

Recently finished titles remain in normal score ranking during their grace period.

## Unranked
Eligible TV anime without a usable `mean` score appear under **Not Ranked Yet**.

Sort alphabetically by display title.

They receive no numbered rank.

## Alternative sorts
- Score — default
- Popularity
- Members
- Newest
- Title

Relevant mappings:
```text
popularity     → popularity
num_list_users → members
start_date     → newest/date logic
```

## Filters
Provide:
- Genre
- Airing day

Remove or simplify the old Type filter because V1 is TV-only.

## Search
Search only AniNow's eligible dataset.

Match at least:
- English/display title;
- MAL main/romaji title.

This is not global MAL search.

## Results
Initially render top **20** ranked results after current filter/sort/search state.

**Load More** reveals more.

## Official MAL field mapping
| MyAnimeList API v2 | AniNow |
| --- | --- |
| `id` | `malId` |
| `title` | `titleRomaji` / fallback display title |
| `alternative_titles.en` | preferred English/display title |
| `main_picture.large/medium` | `image` |
| `mean` | `score` |
| `num_scoring_users` | `scoredBy` |
| `popularity` | `popularity` |
| `num_list_users` | `members` |
| `media_type` | `type` |
| `status` | normalized `status` / `airing` |
| `num_episodes` | `episodes` |
| `broadcast.day_of_the_week` | `broadcastDay` |
| `broadcast.start_time` | `broadcastTime` |
| `genres` | `genres` |
| `studios` | `studio` / `studios` |
| `start_date` | `airedFrom` |
| `end_date` | `airedTo` |
| `start_season` | season/year |
| `synopsis` | synopsis |

Title behavior:
- Prefer `alternative_titles.en` as main English/display title when available.
- Use MAL `title` as romaji/main-source title.
- If English is missing, use `title`.
- Do not render duplicate English/romaji text when both resolve to the same string.

## Leaderboard fields
Where available:
- rank;
- cover;
- English/display title;
- romaji title;
- score;
- scoring-user count;
- studio;
- total episodes;
- next broadcast day/time;
- status;
- members/popularity where useful.

Do not implement "current episode number" unless a reliable low-cost method is explicitly validated.

Never guess unknown totals.

## Top three
#1–#3 receive restrained featured treatment but use the same ranking logic.

#1 artwork may become the blurred atmospheric top background without an extra request.

## Weekly schedule
Build the schedule from the same eligible TV dataset:
```text
eligible TV anime
  ↓
broadcast.day_of_the_week
broadcast.start_time
  ↓
group Monday–Sunday
```

Missing broadcast information goes to an Unknown/TBA state.

Timezone labeling must be explicit. V1 may show source/JST-style schedule time unless local conversion is deliberately implemented and labeled.

## Pages

### `index.html`
Compact header/hero, freshness info, top three, genre/day filters, in-dataset search, sort, dense ranking list, Load More, Not Ranked Yet, attribution footer.

Hero:
> **What's airing? See who's on top.**

### `schedule.html`
Monday–Sunday schedule derived from MAL `broadcast` data.

Show cover/title, broadcast time where available, useful status, and detail-page link.

### `anime.html?id=<MAL_ID>`
Use the official MAL detail endpoint and request only needed fields.

Display artwork, English/display title, romaji title, score, scoring-user count, AniNow rank if feasible, synopsis, genres, studios, TV type, episode total, broadcast, season/year, status, aired dates, external MAL link, and freshness/stale state.

No embedded trailer/autoplay. Trailer link not required for V1.

### `about.html`
Explain TV-only scope, official MAL API v2 data source, score basis, scoring-user count, 14-day grace period, Not Ranked Yet behavior, 30-minute cache model, stale/outage behavior at a high level, and non-affiliation.

Remove Jikan attribution after it is removed from production code/data flow.

### `privacy.html`
Launch assumptions remain: no accounts, user-submitted personal data, persistent favorites, required localStorage, or first-party analytics unless explicitly added.

The final policy must match implementation.

## Navigation
Primary:
- Rankings
- Schedule
- About

Also theme toggle and Refresh where appropriate.

Privacy in footer.

Recently Finished is not a separate page.

## Theme
Light + dark.

Initial mode follows `prefers-color-scheme`.

Manual toggle supported.

Persistence not required.

## Loading and errors
Initial-load failure:
- friendly full error state;
- Retry.

Later retryable refresh failure after successful render:
- preserve existing content;
- show compact non-destructive warning/stale state;
- preserve freshness context.

Definitive responses such as genuinely unavailable/ineligible detail data may replace obsolete content.

## Normalized endpoints
Keep:
```text
GET /api/airing
GET /api/schedule
GET /api/anime/:id
```

`/api/schedule` may internally derive its response from the same eligible airing dataset rather than call a separate upstream schedule endpoint.

Example normalized item:
```json
{
  "malId": 1,
  "title": "English or display title",
  "titleRomaji": "Romaji title",
  "image": "https://...",
  "score": 8.74,
  "scoredBy": 42381,
  "popularity": 100,
  "members": 200000,
  "type": "TV",
  "studio": "Studio",
  "episodes": 12,
  "status": "Currently Airing",
  "airing": true,
  "airedFrom": "ISO-8601/date",
  "airedTo": null,
  "broadcastDay": "Wednesday",
  "broadcastTime": "22:00",
  "broadcastTimezone": "Asia/Tokyo",
  "genres": ["Drama"]
}
```

Top-level responses continue exposing `updatedAt`, `expiresAt`, stale/freshness metadata, and retry metadata where applicable.

## Upstream strategy
Requirements:
- official MAL API v2 only for production V1;
- server-side `MAL_CLIENT_ID`;
- `fields=` to reduce extra calls;
- careful pagination;
- no N+1 leaderboard requests;
- normalization before browser responses;
- successful-response caching;
- last-known-good fallback;
- handling for timeouts, throttling, 4xx/5xx, malformed responses, and partial pagination failures;
- failed/partial refreshes cannot poison good cache;
- conservative request pacing;
- concurrent refresh deduplication where practical.

## Development mock mode
Keep fixture-backed development mode.

Update fixtures to TV-only assumptions.

Requirements:
- same normalized `/api/...` contract;
- enough TV entries for Top 20 + Load More;
- ranked, unranked, currently airing, and recently finished examples;
- varied genres/days/studios/scores/popularity/member counts;
- explicit local/development-only activation;
- `no-store`;
- impossible to activate accidentally in production.

Production must never silently display fake fixture anime.

## Countdown
Derive `mm:ss` from server-provided timestamps.

At zero, request refreshed AniNow data and let backend caching remain authoritative.

After background-tab suspension, recalculate from timestamps rather than blindly decrement an old integer.

## Performance and accessibility
No frontend framework/CDN libraries.

Locally host Noto Sans JP or approved replacement.

Lazy-load offscreen covers, reserve image geometry, keep normalized JSON compact, and fetch detail data only when needed.

Use semantic landmarks, labels, keyboard controls, visible focus, reduced motion, readable contrast, useful alt text, and textual status indicators.

## Attribution and licensing
AniNow is licensed under the **MIT License**.

Preserve third-party asset/font license obligations.

Production attribution:
> Anime data provided by MyAnimeList. AniNow is not affiliated with or endorsed by MyAnimeList.

Do not imply sponsorship or endorsement.

## V1 acceptance criteria
- [ ] Cloudflare Pages + serverless API works.
- [ ] Official MyAnimeList API v2 is the sole production anime-data provider.
- [ ] `MAL_CLIENT_ID` remains server-side only.
- [ ] `.dev.vars` remains gitignored.
- [ ] AniNow normalizes official MAL fields into its stable API contract.
- [ ] ~30-minute fresh cache works.
- [ ] ~24-hour last-known-good fallback works.
- [ ] Current airing discovery uses MAL `ranking_type=airing`.
- [ ] Only `media_type === "tv"` entries are eligible.
- [ ] Explicit adult/Hentai/Rx entries are excluded.
- [ ] Recently finished eligible TV anime stay mixed in ranking for 14 days.
- [ ] Recently finished discovery uses current/previous official MAL seasonal data.
- [ ] Default ranking uses MAL `mean`.
- [ ] Scoring-user count uses `num_scoring_users`.
- [ ] No custom minimum-rating threshold.
- [ ] Not Ranked Yet is alphabetical.
- [ ] Top 20 + Load More works.
- [ ] Genre/day filters work.
- [ ] Old TV/ONA/OVA Type filter is removed or simplified.
- [ ] Score/popularity/members/newest/title sorts work.
- [ ] English/romaji in-dataset search works.
- [ ] Weekly schedule derives from MAL `broadcast` data.
- [ ] Top-three treatment + #1 blurred backdrop/fallback works.
- [ ] `mm:ss` freshness/retry countdown works.
- [ ] Manual Refresh respects cache.
- [ ] Rankings/schedule/detail retain rendered content on later retryable refresh failure.
- [ ] Dynamic detail page uses official MAL data.
- [ ] About/methodology reflects TV-only official-MAL architecture.
- [ ] Privacy matches implementation.
- [ ] OS-following light/dark theme + manual toggle works.
- [ ] Skeleton, empty, error, Retry, stale, and warning states work.
- [ ] Intentional mobile composition works.
- [ ] Local font assets; no font/CSS/JS/icon CDN.
- [ ] Development fixtures are TV-only and production-safe.
- [ ] Attribution/non-affiliation is accurate.
- [ ] MIT LICENSE and README are ready for public release.
- [ ] Existing unit/function, browser, mock, and accessibility tests pass after migration.
