# PRD.md — AniNow

## Product
AniNow is an open-source anime discovery website answering:

> **What's airing? See who's on top.**

AniNow ranks eligible **currently airing TV anime** by MyAnimeList score, keeps recently finished eligible TV titles in the same leaderboard for a 14-day grace period, and provides a weekly airing schedule.

Core anime data comes directly from the **official MyAnimeList API v2** through AniNow's Cloudflare serverless layer. AniList may supplement exact next-episode airing information when it can be matched reliably by MAL ID.

AniNow is intended to remain useful beyond its portfolio role.

## Goals
- Current, scan-friendly TV-anime leaderboard.
- MAL score is the default ranking.
- Display number of scoring users.
- Keep recently finished TV anime for 14 days in the same ranking.
- Keep eligible unrated TV anime under **Not Ranked Yet**.
- Genre/day filters, sorting, and in-dataset search.
- Weekly schedule generated from the same eligible dataset.
- Reliable next-episode number, aired-episode progress, and countdown when AniList supplies a valid exact airing event.
- Dynamic anime detail pages.
- ~30-minute freshness/cache cadence.
- Last-known-good resilience during upstream outages.
- Fast, accessible, responsive, maintainable, open-source implementation.

## Non-goals
No accounts, MAL login/OAuth, watchlists, comments, AniNow ratings, streaming/piracy links, persistent favorites, global MAL search, movie rankings, ONA/OVA rankings, or recommendation engine.

## Upstream providers and source authority
The **official MyAnimeList API v2** remains AniNow's primary and authoritative provider. MAL owns discovery, eligibility, ranking, score, scoring-user count, titles, artwork, genres, status, total episode count, details, recurring broadcast fields, and every existing metadata field.

AniList is an optional supplemental provider for episode-airing information that MAL does not reliably expose. AniNow may use only:
- `idMal` as the cross-provider match key;
- `nextAiringEpisode.episode` as the next episode number;
- `nextAiringEpisode.airingAt` as the exact next airing timestamp;
- `nextAiringEpisode.timeUntilAiring` only as a validation aid or short-lived upstream value, not as the durable source for a countdown.

Source-of-truth rules:
- Never use AniList to discover titles, determine eligibility, rank entries, or replace any MAL-owned field.
- Match AniList records to AniNow records only when `idMal` exactly equals the MAL ID. Do not use title matching as the primary match or as an automatic fallback.
- An absent, malformed, expired, mismatched, or contradictory AniList result produces no enrichment. Keep the MAL-derived presentation.
- A valid next-airing event requires a positive integer episode number and a finite future `airingAt`. If MAL supplies a total, the next episode number must not exceed it.
- Never estimate episode progress by adding one episode every seven days or by projecting MAL's recurring broadcast time.
- Never fabricate or clamp episode numbers or timestamps. AniList enrichment must not overwrite MAL's `num_episodes`; an unknown MAL total remains unknown.
- Do not silently add Jikan, scraping, Kitsu, or another provider as fallback.

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
  ├─ primary path → Official MyAnimeList API v2
  │                  ↓
  │                normalize + eligibility/business rules
  │                  ↓
  │                primary cache + last-known-good snapshot
  └─ optional path → AniList GraphQL API
                     ↓ exact `idMal` match
                   validate next-airing fields
                     ↓
                   separate supplemental cache/failure boundary
  ↓
merge valid optional enrichment into AniNow JSON
  ↓
frontend
```

Frontend consumes AniNow's normalized API, not raw MAL or AniList responses. The browser never calls either provider directly.

## Refresh and resilience
Preserve:
- ~30-minute fresh cache;
- ~24-hour last-known-good data;
- failed-refresh suppression/backoff;
- concurrent refresh deduplication where practical;
- stale metadata;
- non-destructive refresh failure when valid content is already rendered;
- full error state only when no usable data exists.

UI shows the last successful update and stale/failure status where applicable. When freshness expires, the browser automatically requests refreshed AniNow data while backend caching remains authoritative.

"Live/current" means periodically refreshed, not second-by-second real-time MAL updates.

AniList enrichment uses a separate cache, retry suppression, and concurrent-request deduplication boundary. A failed AniList refresh must not fail, mark stale, or replace a successful MAL refresh, and AniList requests need a bounded timeout. Supplemental failures silently fall back to MAL-only output without a user-visible error or notice. The initial implementation should use the same approximate 30-minute fresh cadence unless provider behavior justifies a documented change. Last-known-good next-airing data may be reused only while its exact `airingAt` remains in the future and the match is still valid.

The existing visible `mm:ss` timer continues to describe AniNow cache freshness. A future next-episode countdown is a separate UI value computed from the absolute `nextAiringAt` timestamp. Reaching zero may request a refresh through the normal cache path, but must never advance the episode locally or generate another timestamp by adding seven days.

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

## Supplemental AniList field mapping
| AniList | AniNow | Rule |
| --- | --- | --- |
| `idMal` | `malId` match only | Must exactly equal the existing MAL ID |
| `nextAiringEpisode.episode` | `nextEpisodeNumber` | Positive integer or `null` |
| `nextAiringEpisode.airingAt` | `nextAiringAt` | Unix timestamp normalized to ISO-8601, or `null` |
| derived from a valid next episode | `airedEpisodes` | `nextEpisodeNumber - 1`, otherwise `null` |

`timeUntilAiring` may be checked against `airingAt` when validating the upstream response, but AniNow countdowns use `nextAiringAt - current time` so cached values do not drift. The supplemental fields are nullable and must disappear or become `null` when the event expires and no newer reliable event is available.

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
- next broadcast day/time from MAL;
- next episode number, aired-episode progress, and exact next-airing countdown when reliable AniList enrichment exists;
- status;
- members/popularity where useful.

Episode progress may be shown only when it is derived directly from a valid AniList `nextAiringEpisode`: the aired count is one less than the next episode number. If that record is unavailable or expired, omit the progress value and use the existing MAL-derived presentation. Never guess unknown totals or replace MAL's total with AniList data.

## Top three
#1–#3 receive restrained featured treatment but use the same ranking logic.

#1 artwork may become the blurred atmospheric top background without an extra request.

## Weekly schedule
Build the schedule from the same MAL-owned eligible TV dataset:
```text
eligible TV anime
  ↓
MAL broadcast.day_of_the_week + broadcast.start_time
  ↓
group Monday–Sunday
  ↓
optionally annotate with AniList's exact upcoming episode event
```

MAL `broadcast` defines the regular weekly schedule and always controls Schedule page grouping. AniList must never add a title to the schedule or move it to another weekday. A delay, special airing, or irregular AniList event may change the displayed next episode number, exact date/time, progress, or countdown for that entry, but it does not change the entry's MAL-derived schedule group.

The browser converts valid MAL `Asia/Tokyo` broadcast weekdays and times to the visitor's local timezone for recurring schedule grouping. It separately converts AniList's absolute `nextAiringAt` for the exact upcoming-event annotation. If MAL broadcast information is incomplete or invalid, the title remains in the Unknown/TBA schedule group even when AniList supplies an exact next-airing event. Local timezone labeling must be explicit. Do not infer later occurrences from either source.

## Pages

### `index.html`
Compact header/hero, freshness info, top three, genre/day filters, in-dataset search, sort, dense ranking list, Load More, Not Ranked Yet, attribution footer.

Hero:
> **What's airing? See who's on top.**

### `schedule.html`
Monday–Sunday recurring schedule for the MAL-owned eligible dataset, grouped only by MAL `broadcast` data.

Show cover/title, recurring MAL broadcast time where available, reliable AniList next episode/date/time/countdown as separate supplemental information, useful status, and detail-page link. AniList event timing must not change the entry's schedule group.

### `anime.html?id=<MAL_ID>`
Use the official MAL detail endpoint and request only needed fields.

Display artwork, English/display title, romaji title, score, scoring-user count, AniNow rank if feasible, synopsis, genres, studios, TV type, MAL episode total, broadcast, reliable next-episode progress/countdown when available, season/year, status, aired dates, external MAL link, and freshness/stale state.

No embedded trailer/autoplay. Trailer link not required for V1.

### `about.html`
Explain TV-only scope, MAL's primary and authoritative role, AniList's limited supplemental role, score basis, scoring-user count, 14-day grace period, Not Ranked Yet behavior, 30-minute cache model, stale/outage behavior at a high level, and non-affiliation.

Remove Jikan attribution after it is removed from production code/data flow.

### `privacy.html`
Launch assumptions remain: no accounts, user-submitted personal data, persistent favorites, required localStorage, or first-party analytics unless explicitly added.

The final policy must match implementation.

## Navigation
Primary:
- Rankings
- Schedule
- About

Also a theme toggle.

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
  "nextEpisodeNumber": 6,
  "nextAiringAt": "2026-09-16T13:00:00.000Z",
  "airedEpisodes": 5,
  "genres": ["Drama"]
}
```

The three supplemental fields are `null` when no valid AniList event exists. Existing fields keep their MAL meaning.

Top-level responses continue exposing `updatedAt`, `expiresAt`, stale/freshness metadata, and retry metadata where applicable. Those existing fields retain their current primary dataset semantics. This release does not expose supplemental AniList freshness metadata because the frontend has no concrete need for it; an AniList outage cannot make fresh MAL data appear stale.

## Upstream strategy
Requirements:
- official MAL API v2 as the primary and authoritative provider;
- AniList GraphQL only for optional `nextAiringEpisode` enrichment matched by exact `idMal`;
- server-side `MAL_CLIENT_ID`;
- server-side provider calls only;
- `fields=` to reduce extra calls;
- careful pagination;
- no N+1 leaderboard requests;
- bounded/batched AniList lookups for currently airing MAL IDs;
- normalization before browser responses;
- separate successful-response caching and failure handling for primary and supplemental data;
- MAL last-known-good fallback plus supplemental reuse only while a validated event remains in the future;
- handling for timeouts, throttling, 4xx/5xx, malformed responses, and partial pagination failures;
- failed/partial refreshes cannot poison good cache;
- AniList failure silently degrades to MAL-only output without a user-visible error or notice;
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
- valid, absent, mismatched, malformed, and expired supplemental next-airing examples;
- explicit local/development-only activation;
- `no-store`;
- impossible to activate accidentally in production.

Production must never silently display fake fixture anime.

## Background refresh
Schedule the next refresh from server-provided timestamps.

At expiry, request refreshed AniNow data and let backend caching remain authoritative.

After background-tab suspension, request expired data promptly when the browser resumes execution.

## Performance and accessibility
No frontend framework/CDN libraries.

Locally host Noto Sans JP or approved replacement.

Lazy-load offscreen covers, reserve image geometry, keep normalized JSON compact, and fetch detail data only when needed.

Use semantic landmarks, labels, keyboard controls, visible focus, reduced motion, readable contrast, useful alt text, and textual status indicators.

## Attribution and licensing
AniNow is licensed under the **MIT License**.

Preserve third-party asset/font license obligations.

Production attribution:
> Anime rankings and metadata provided by MyAnimeList. Episode airing information may be supplemented by AniList. AniNow is not affiliated with or endorsed by MyAnimeList or AniList.

Do not imply sponsorship or endorsement.

## V1 acceptance criteria
- [ ] Cloudflare Pages + serverless API works.
- [ ] Official MyAnimeList API v2 remains the primary and authoritative provider for discovery, eligibility, rankings, and existing metadata.
- [ ] AniList is used only for optional `nextAiringEpisode` enrichment matched by exact `idMal`.
- [ ] Missing or failed AniList enrichment preserves the existing MAL-derived presentation.
- [ ] AniList cannot add titles, change eligibility/rankings, overwrite MAL fields, or fill unknown MAL episode totals.
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
- [ ] Weekly schedule grouping and recurring time use MAL `broadcast` data only.
- [ ] AniList next-airing events may annotate schedule entries but never add, remove, or move titles between schedule groups.
- [ ] Episode progress is never advanced by a seven-day estimate.
- [ ] Episode countdown expiry respects cache/backoff and never fabricates the next event.
- [ ] Top-three treatment + #1 blurred backdrop/fallback works.
- [ ] Automatic background refresh respects cache.
- [ ] Rankings/schedule/detail retain rendered content on later retryable refresh failure.
- [ ] Dynamic detail page uses official MAL data with optional AniList next-airing enrichment.
- [ ] About/methodology reflects the TV-only MAL-primary, AniList-supplemental architecture.
- [ ] Privacy matches implementation.
- [ ] OS-following light/dark theme + manual toggle works.
- [ ] Skeleton, empty, error, Retry, stale, and warning states work.
- [ ] Intentional mobile composition works.
- [ ] Local font assets; no font/CSS/JS/icon CDN.
- [ ] Development fixtures are TV-only and production-safe.
- [ ] Attribution/non-affiliation is accurate.
- [ ] MIT LICENSE and README are ready for public release.
- [ ] Existing unit/function, browser, mock, and accessibility tests pass after migration.
