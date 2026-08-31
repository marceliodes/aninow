# AniNow

AniNow is a framework-free, multi-page anime discovery site for current rankings and weekly broadcast schedules. Anime data is sourced from MyAnimeList through the unofficial Jikan API, normalized and cached by Cloudflare Pages Functions.

## Local development

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Then visit `http://localhost:4174`.

`npm run dev` runs this exact Cloudflare Pages command:

```sh
WRANGLER_LOG_PATH=/tmp/aninow-wrangler.log npx wrangler pages dev . --port 4174 --local-protocol http
```

Use Wrangler for local development. A static-only server such as Python's
`http.server`, an editor Live Server extension, or `npx serve` will display the
HTML but cannot execute `functions/api/*`; API requests will therefore return a
non-JSON page or 404. The browser should request AniNow's same-origin
`/api/airing`, `/api/schedule`, and `/api/anime/:id` routes, while Wrangler makes
the server-side requests to Jikan.

The first uncached request can take several seconds because AniNow collects all
required Jikan pages while respecting upstream pacing. If Jikan or
MyAnimeList is temporarily unavailable, the API returns a structured JSON error
and the UI displays Retry; a recent complete cache is served as stale data when
available.

### Development fixture mode

When Jikan is unavailable, run AniNow with realistic normalized fixtures:

```sh
npm run dev:mock
```

Then open `http://localhost:4174`. Rankings, schedule, and detail pages continue
to call the same `/api/...` routes and receive the production response shape.
The fixture dataset includes more than 20 ranked titles, multiple media types,
genres and broadcast days, recently finished titles, unknown schedule fields,
and unranked titles.

Fixture mode is guarded in three ways: the explicit local-only binding from the
command above, Wrangler's `CF_PAGES_BRANCH=local` environment, and a localhost
request hostname. Production requests always use the normal cached Jikan path,
even if the mock binding were mistakenly configured there. Fixture responses
also use `Cache-Control: no-store` and cannot populate the production cache.

To run a browser integration pass against the actual fixture-backed Pages
Functions rather than intercepted API responses:

```sh
npm run test:e2e:mock
```

## Tests

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

The deterministic test suite mocks upstream and browser API responses. Production publishing and Cloudflare project setup are intentionally not included.

## Data and privacy

The browser calls same-origin `/api/...` routes only. The UI has no accounts, analytics, cookies, or persistent favorites. Theme choice is stored for the current browser session only. Remote cover art is loaded from MyAnimeList's image host.

## Licensing

AniNow is released under the MIT License; see `LICENSE`. The vendored Noto Sans JP font remains licensed separately under the SIL Open Font License 1.1; see `assets/fonts/OFL.txt`.
