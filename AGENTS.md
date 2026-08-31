# AGENTS.md — AniNow

## Project
AniNow is an open-source, multi-page anime discovery site focused on one question:

**What TV anime is airing now, and which titles are rated highest?**

Before substantial work, read `PRD.md` for product/data behavior and `DESIGN.md` for visual direction.

## Stack
Use semantic HTML5, CSS3, vanilla JavaScript, Cloudflare Pages, Cloudflare Pages Functions/Workers, and the official MyAnimeList API v2 as the sole production anime-data provider.

Do not introduce React, Vue, Svelte, Angular, Next.js, Tailwind, Bootstrap, or another frontend framework unless explicitly requested.

## Architecture boundary
The browser calls AniNow's own `/api/...` endpoints.

The Cloudflare layer must:
- call the official MyAnimeList API v2;
- authenticate with server-side `MAL_CLIENT_ID`;
- normalize MAL responses into AniNow-specific JSON;
- apply eligibility/business rules;
- cache successful responses;
- retain last-known-good data;
- handle upstream failures defensively.

The frontend must not call MyAnimeList directly.

Do not silently add Jikan, scraping, AniList, Kitsu, or another provider as fallback.

## Credentials
Local development uses `.dev.vars`.

Expected:
```text
MAL_CLIENT_ID="..."
```

Rules:
- `.dev.vars` and `.env*` remain gitignored.
- Never hard-code Client ID/Secret in HTML, frontend JS, committed tests, docs, or fixtures.
- Never expose credentials in API responses or logs.
- Production credentials belong in Cloudflare environment bindings/secrets.
- MAL Client Secret is not needed for AniNow V1 unless future OAuth functionality explicitly requires it.

## Upstream usage
Main airing discovery:
- official MAL anime ranking endpoint;
- `ranking_type=airing`;
- paginate as needed;
- request required metadata with `fields=`;
- keep only `media_type === "tv"`.

Recently finished:
- fetch current and previous MAL seasonal datasets;
- keep TV anime with `status === "finished_airing"` and a reliable `end_date` within 14 days;
- merge with current-airing data;
- deduplicate by MAL ID.

Schedule:
- derive Monday–Sunday schedule from the eligible dataset's `broadcast` fields;
- do not depend on a separate schedule provider.

Avoid N+1 requests. Do not fetch one detail record per leaderboard item merely to fill normal list metadata.

## Normalized API contract
Keep frontend code insulated from raw MAL fields.

Typical mapping:
```text
id                    → malId
title                 → titleRomaji / fallback display title
alternative_titles.en → preferred English/display title
main_picture          → image
mean                  → score
num_scoring_users     → scoredBy
popularity            → popularity
num_list_users        → members
media_type            → type
num_episodes          → episodes
status                → normalized status/airing
broadcast             → broadcast day/time
genres                → genres
studios               → studio/studios
start_date            → airedFrom
end_date              → airedTo
start_season          → season/year
synopsis              → synopsis
```

Preserve AniNow's existing `/api/...` response shape unless an explicit product requirement requires a change.

## Cache and refresh policy
Preserve the established release behavior:
- ~30-minute fresh cache;
- ~24-hour last-known-good fallback;
- failed-refresh suppression/backoff;
- concurrent refresh deduplication where practical;
- stale metadata;
- non-destructive refresh failures when usable content already exists;
- full error state only when no usable data exists.

Automatic countdown expiry and Retry requests must respect cache and must not hammer MAL.

The visible `mm:ss` countdown reflects AniNow cache freshness, not second-by-second MAL freshness.

## Eligibility
AniNow V1 is **TV anime only**.

Do not reintroduce ONA, OVA, movies, specials, or other media types unless `PRD.md` changes explicitly.

Exclude explicit adult/Hentai/Rx entries using available MAL classification fields. Do not over-filter ordinary mature/ecchi TV anime unless product requirements say otherwise.

## No-CDN rule
Do not use CDNs for fonts, frontend CSS/JS libraries, or icon libraries.

Store redistributable fonts locally and load with `@font-face`.

Remote anime artwork returned by MAL is expected and exempt. Do not commit copyrighted anime artwork merely to make it local.

## Data integrity
Never invent MAL scores, scoring-user counts, popularity/members, studios, broadcast times, episode totals, dates, or rankings.

Use MAL's supplied score/weighting. Do not invent a custom minimum-vote threshold or rating formula.

## Licensing and attribution
AniNow is released under the MIT License.

Preserve third-party license notices, including local font licensing.

AniNow must not imply affiliation with or endorsement by MyAnimeList.

Production wording may use:
> Anime data provided by MyAnimeList. AniNow is not affiliated with or endorsed by MyAnimeList.

Remove Jikan attribution only after Jikan is fully removed from the production code/data path.

## UX quality
Every visible control must work: genre/day filters, sorting, in-dataset search, Load More, theme toggle, navigation, detail links, and external MAL links.

If a Type filter remains after the TV-only migration, remove or simplify it; do not show meaningless TV/ONA/OVA options.

Provide skeleton loading, empty states, initial-load errors, Retry, freshness timestamps, stale states, and non-destructive refresh warnings.

## Accessibility
Use semantic elements, labels, keyboard-accessible controls, visible focus states, sufficient contrast, meaningful alt text, reduced-motion support, and text alongside status colors.

## Responsive design
Desktop uses a dense vertical ranking list. Tablet reduces secondary metadata. Mobile deliberately recomposes rows into compact readable items; do not shrink a desktop table until unreadable.

## Anti-slop workflow
AniNow must not look like a generic AI SaaS page.

For UI work:
1. Read `DESIGN.md`.
2. Use its product-specific direction.
3. Audit for generic AI defaults.
4. Keep glassmorphism only where `DESIGN.md` gives it a purpose.

## Tests
Provider migration must preserve or improve existing test coverage.

Test at minimum:
- MAL normalization;
- TV-only filtering;
- airing discovery;
- 14-day finished grace;
- deduplication;
- unranked behavior;
- schedule grouping from `broadcast`;
- cache/stale fallback;
- upstream errors;
- mock fixture safety;
- rankings/schedule/detail browser behavior;
- accessibility.

Do not weaken assertions just to make the migration pass.

Development mock mode must keep the same normalized `/api/...` shape and remain impossible to activate accidentally in production.

## Working rules
Before editing:
1. inspect existing code;
2. read the specs;
3. preserve unrelated working behavior;
4. avoid broad refactors beyond what the provider migration requires;
5. test affected API/browser states.

Priority on conflict:
1. current explicit user instruction;
2. `PRD.md`;
3. `DESIGN.md`;
4. this file.

**Build an anime-fan product, not a portfolio-shaped demo.**
