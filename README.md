# AniNow

AniNow is a framework-free, multi-page site for discovering currently airing TV anime, recently finished TV titles, and weekly broadcast schedules. Cloudflare Pages Functions retrieve anime data from the official MyAnimeList API v2, normalize it, and cache it for the frontend.

## Local development

Before you begin, install Node.js 20 or later.

To run AniNow locally:

1. Go to the [MyAnimeList API application page](https://myanimelist.net/apiconfig), create a MAL API application, and obtain its Client ID.
2. Create a `.dev.vars` file in the repository root. Add the Client ID to the file:

   ```text
   MAL_CLIENT_ID="your-client-id"
   ```

   `.dev.vars` is gitignored. AniNow requires only the Client ID for its public, read-only requests. Do not add a Client Secret because AniNow does not use OAuth.

3. Install the project dependencies:

   ```sh
   npm install
   ```

4. Start the local development server:

   ```sh
   npm run dev
   ```

5. Open `http://localhost:4174`.

Wrangler runs the Cloudflare Pages Functions that serve `/api/airing`, `/api/schedule`, and `/api/anime/:id`. A static-only server cannot execute these routes. The Client ID remains in the server-side Cloudflare environment. AniNow does not send it to browser code or include it in API responses.

The first uncached request can take several seconds while AniNow paginates the MAL airing ranking and the current and previous seasonal datasets. AniNow caches successful data as fresh for about 30 minutes and retains it as a last-known-good fallback for about 24 hours. If a later refresh fails, AniNow serves the fallback data as stale.

### Development fixture mode

To run the site without live MAL access, start the fixture server:

```sh
npm run dev:mock
```

The fixtures use the normalized `/api/...` response shape from production. They include more than 20 ranked TV titles, unranked TV titles, recently finished titles, every weekday, and unknown or TBA broadcasts.

Fixture mode activates only when `ANINOW_DEV_MOCK=1`, `CF_PAGES_BRANCH=local`, and the request uses a localhost hostname. Fixture responses use `Cache-Control: no-store`, cannot populate the production cache, and cannot activate on a production hostname.

To run the end-to-end tests against the fixture server:

```sh
npm run test:e2e:mock
```

## Tests

Run the unit and Cloudflare Pages Function tests:

```sh
npm test
```

Install the Playwright Chromium browser once, then run the browser test suites:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:e2e:mock
npm run test:a11y
```

The deterministic suites mock upstream and browser API responses. This repository does not automate deployment or production secret configuration.

## Data and privacy

The browser calls only same-origin `/api/...` routes. The UI has no accounts, analytics, cookies, or persistent favorites. AniNow stores the theme choice only for the current browser session. It loads remote cover art from MyAnimeList's image host.

Anime data provided by MyAnimeList. AniNow is not affiliated with or endorsed by MyAnimeList.

## Licensing

AniNow is released under the [MIT License](LICENSE). The vendored Noto Sans JP font is licensed separately under the SIL Open Font License 1.1. For details, see the [font license notice](assets/fonts/OFL.txt).
