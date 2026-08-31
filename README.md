# AniNow

AniNow is a framework-free, multi-page discovery site for TV anime airing now, recently finished TV titles, and weekly broadcast schedules. Anime data comes directly from the official MyAnimeList API v2, then is normalized and cached by Cloudflare Pages Functions.

## Local development

Requires Node.js 20 or newer and a MyAnimeList API Client ID. Create an application in MyAnimeList API settings, then add an ignored `.dev.vars` file:

```text
MAL_CLIENT_ID="your-client-id"
```

Only the Client ID is needed for AniNow’s public read-only requests. Do not add a Client Secret; AniNow does not use OAuth.

```sh
npm install
npm run dev
```

Then visit `http://localhost:4174`. Wrangler runs the Pages Functions that serve `/api/airing`, `/api/schedule`, and `/api/anime/:id`; a static-only server cannot execute those routes. The Client ID stays in the server-side Cloudflare environment and is never sent to browser code or included in AniNow API responses.

The first uncached request may take several seconds while AniNow paginates the MAL airing ranking and current/previous seasonal datasets. Successful data is fresh-cached for about 30 minutes, retained as a last-known-good fallback for about 24 hours, and served as stale when a later refresh fails.

### Development fixture mode

To work without live MAL access:

```sh
npm run dev:mock
```

The fixtures use the production normalized `/api/...` response shape and include more than 20 ranked TV titles, unranked TV titles, recent finishes, every weekday, and unknown/TBA broadcasts. Fixture mode requires the explicit mock binding, Wrangler’s local branch, and a localhost hostname. Its responses use `Cache-Control: no-store`, cannot populate the production cache, and cannot activate on a production hostname.

```sh
npm run test:e2e:mock
```

## Tests

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run test:e2e:mock
npm run test:a11y
```

The deterministic suites mock upstream and browser API responses. Deployment and production-secret configuration are intentionally outside this repository workflow.

## Data and privacy

The browser calls same-origin `/api/...` routes only. The UI has no accounts, analytics, cookies, or persistent favorites. Theme choice is stored for the current browser session only. Remote cover art is loaded from MyAnimeList’s image host.

Anime data provided by MyAnimeList. AniNow is not affiliated with or endorsed by MyAnimeList.

## Licensing

AniNow is released under the MIT License; see `LICENSE`. The vendored Noto Sans JP font remains licensed separately under the SIL Open Font License 1.1; see `assets/fonts/OFL.txt`.
