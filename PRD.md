# PRD.md --- AniNow

## Product

AniNow is an open-source anime discovery website answering:

> **What's airing? See who's on top.**

It ranks all eligible currently airing anime by MyAnimeList score, keeps
recently finished titles for a 14-day grace period, and provides a
weekly airing schedule. Data comes from MyAnimeList via Jikan and is
normalized/cached through Cloudflare serverless endpoints.

AniNow is intended to remain useful beyond its portfolio role.

## Goals

-   Current, scan-friendly airing leaderboard.
-   MAL score is default ranking.
-   Show `scored_by`.
-   Keep recently finished shows for 14 days in the same ranking.
-   Keep eligible unrated shows visible under Not Ranked Yet.
-   Filters/sorts/search over AniNow's eligible dataset.
-   Weekly schedule and dynamic detail pages.
-   30-minute cache cadence.
-   Fast, accessible, responsive, open-source-friendly implementation.

## Non-goals

No accounts, watchlists, comments, AniNow ratings, streaming/piracy
links, MAL authentication, persistent favorites, global MAL search, or
movie leaderboard.

## Architecture

``` text
Browser
  ↓
Cloudflare Pages
  ↓ /api/...
Cloudflare Pages Function / Worker
  ↓ cache miss
Jikan REST API
  ↓
normalize + eligibility rules
  ↓
cache ~30 minutes
  ↓
frontend
```

Frontend consumes AniNow's normalized API, not raw Jikan directly.

## Refresh

Cache target: **30 minutes** for leaderboard, schedule, and initially
details.

UI shows last successful update, `mm:ss` countdown to expected expiry,
and Refresh.

Refresh re-requests AniNow's endpoint but respects server cache. It must
not force repeated Jikan calls.

"Live/current" means periodically refreshed; do not claim
second-by-second real-time MAL updates.

## Eligibility

Include: - all currently airing eligible anime, including long-running
shows; - TV; - ONA; - OVA, including periodic ONA/OVA releases
represented as airing/releasing by source data.

Exclude: - Movies; - Hentai/explicit adult entries (e.g. Rx adult
classification); - entries outside current/recently-finished rules.

Ordinary mature/ecchi titles are not automatically excluded solely for
being mature; use available source classification carefully.

## Recently finished lifecycle

When an eligible anime becomes Finished Airing: - keep it in the **same
leaderboard**; - retain for 14 days after reliable final aired date; -
keep normal score-based ordering; - show Finished status and
grace-period context where feasible; - remove after 14 days.

If Finished status lacks a reliable final date, do not invent one. Keep
date logic isolated and handle conservatively after testing real API
behavior.

## Ranking

Default: MAL `score` descending.

Use MAL's supplied score/weighting. AniNow adds **no custom minimum-vote
threshold** and no custom rating formula.

Display `scored_by`.

Stable tie-break: 1. greater `scored_by`; 2. title alphabetically.

## Unranked

Eligible entries without a usable score appear under **Not Ranked Yet**,
alphabetically by display/English title. They receive no numbered rank.

## Alternative sorts

-   Score (default)
-   Popularity
-   Members
-   Newest
-   Title

Map these directly to available normalized fields and document
definitions in code.

## Filters

-   Type: All / TV / ONA / OVA
-   Genre
-   Airing day

## Search

Search only AniNow's eligible loaded dataset, matching at least
English/display and romaji titles. This is not global MAL search.

## Results

Initially render top **20** ranked results after current
filters/search/sort. **Load More** reveals additional entries.

## Leaderboard fields

Required where available: - rank - cover - English/display title -
romaji title - score - `scored_by` - studio - type - total/max
episodes - next broadcast/day - status

Do not implement "current episode number" unless a later reliable
low-cost method is validated. Never guess.

## Top three

#1--#3 receive restrained featured treatment but use the same ranking
logic. #1 artwork may become the blurred top-area background without an
extra API request.

## Pages

### `index.html`

Compact header/hero, freshness info, top three, controls, ranked
vertical list, Load More, Not Ranked Yet, attribution footer.

Hero direction: \> **What's airing? See who's on top.**

### `schedule.html`

Monday--Sunday airing schedule for AniNow-relevant anime. Show
cover/title, broadcast time where available, useful status/type, and
detail-page link.

Timezone must be explicit. Initially show source timezone such as JST
unless reliable local conversion is intentionally implemented and
labeled.

### `anime.html?id=<MAL_ID>`

Display artwork, English/display title, romaji title, score,
`scored_by`, AniNow rank if feasible, synopsis, genres, studios, type,
episodes, broadcast, season/year, status, aired dates, and external
MyAnimeList link.

No embedded trailer/autoplay. Trailer link is not required for v1.

### `about.html`

Explain purpose, eligibility, TV/ONA/OVA inclusion, movie/adult
exclusions, MAL score basis, `scored_by`, 14-day grace, unranked
behavior, 30-minute refresh/cache, Jikan/MAL attribution, and
non-affiliation.

### `privacy.html`

Launch assumption: no accounts, submitted personal data, persistent
favorites, required localStorage, or first-party analytics unless later
added. Final wording must match implementation. Mention relevant
third-party requests without inventing legal conclusions.

## Navigation

Primary: Rankings, Schedule, About. Also theme toggle and Refresh where
appropriate. Recently Finished is not a separate page. Privacy is in
footer.

## Theme

Light + dark. Initial theme follows `prefers-color-scheme`. Manual
toggle supported. Persistence not required.

## Loading/errors

Use skeleton rows. Handle invalid/non-200 responses with friendly error,
Retry, last successful update when known, and stale-data indication if
backend can provide it. Never leave a blank page.

## Suggested normalized endpoints

``` text
GET /api/airing
GET /api/schedule
GET /api/anime/:id
```

Example item shape:

``` json
{
  "malId": 1,
  "title": "Display Title",
  "titleRomaji": "Romaji Title",
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
  "airedFrom": "ISO-8601",
  "airedTo": null,
  "broadcastDay": "Fridays",
  "broadcastTime": "23:00",
  "broadcastTimezone": "Asia/Tokyo",
  "genres": ["Drama"]
}
```

Top-level responses should expose `updatedAt`, `expiresAt`, and
stale/freshness metadata where useful. Adapt exact fields after checking
current Jikan v4 responses.

## Upstream strategy

Before coding endpoints, inspect current Jikan v4 docs rather than
relying on memory.

Requirements: - cache normalized responses; - avoid N+1 leaderboard
requests; - do not fetch per-anime episode lists just to infer current
episode; - handle 429/5xx; - deduplicate refresh work where practical; -
prefer safe stale cache over total failure when technically feasible.

## Countdown

Derive `mm:ss` from `expiresAt`. At zero, request refreshed AniNow data
and reset from returned timestamps. Recalculate from timestamps after
background-tab suspension; do not rely only on decrementing an integer.

## Performance/accessibility

No framework/CDN libraries. Locally host Noto Sans JP (or approved
replacement). Lazy-load offscreen covers, reserve image geometry, keep
JSON compact, and fetch detail data only when needed.

Use semantic landmarks, labels, keyboard controls, visible focus,
reduced motion, readable contrast, useful alt text, and textual status
indicators.

## Attribution and licensing

Footer direction:

> Anime data sourced from MyAnimeList via Jikan. AniNow is not
> affiliated with MyAnimeList.

Jikan is unofficial. Do not imply endorsement.

AniNow is released under the **MIT License**. Jikan's software is also
MIT-licensed, but API consumption does not by itself require AniNow to
copy Jikan's license. Vendored third-party assets/code/fonts retain
their own obligations.

## V1 acceptance

-   [ ] Cloudflare Pages + serverless API works.
-   [ ] AniNow API normalizes Jikan data.
-   [ ] \~30-minute caching works.
-   [ ] Eligible currently airing TV/ONA/OVA are represented.
-   [ ] Movies and explicit adult/Hentai entries are excluded.
-   [ ] Finished entries remain mixed in ranking for 14 days.
-   [ ] Score-descending default + `scored_by`.
-   [ ] No invented minimum-rating threshold.
-   [ ] Not Ranked Yet is alphabetical.
-   [ ] Top 20 + Load More.
-   [ ] Type/genre/day filters.
-   [ ] Score/popularity/members/newest/title sorts.
-   [ ] In-dataset title search.
-   [ ] Top-three treatment + #1 blurred backdrop/fallback.
-   [ ] `mm:ss` refresh countdown from timestamps.
-   [ ] Manual Refresh respects cache.
-   [ ] Schedule page.
-   [ ] Dynamic anime detail page.
-   [ ] About/methodology page.
-   [ ] Privacy page matches implementation.
-   [ ] OS-following light/dark theme + manual toggle.
-   [ ] Skeleton/error/Retry states.
-   [ ] Intentional mobile composition.
-   [ ] Local font assets; no font/CSS/JS/icon CDN.
-   [ ] Attribution/non-affiliation.
-   [ ] README/license prepared for public release.
