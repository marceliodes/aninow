# AGENTS.md --- AniNow

## Project

AniNow is an open-source, multi-page anime discovery site focused on:
**what is airing now, and which titles are rated highest?** It is
intended to be useful to anime fans, not merely a portfolio mockup.

Before substantial work, read `PRD.md` for product/data behavior and
`DESIGN.md` for visual direction.

## Stack

Use semantic HTML5, CSS3, vanilla JavaScript, Cloudflare Pages, and
Cloudflare Pages Functions/Workers. Jikan REST API is the upstream
source for public MyAnimeList-derived data.

Do not introduce React, Vue, Svelte, Angular, Next.js, Tailwind,
Bootstrap, or another frontend framework unless explicitly requested.

## Architecture boundary

The browser calls AniNow's own `/api/...` endpoints. The Cloudflare
layer fetches Jikan, normalizes responses, applies eligibility rules
where appropriate, caches data, and handles upstream failures. Do not
make the main UI depend on direct browser-to-Jikan requests.

Default cache target: **30 minutes**. Manual Refresh respects server
cache and must not hammer Jikan. The visible `mm:ss` countdown is an
estimate until AniNow's next refresh, not a claim of second-by-second
MAL freshness.

## Repository

Suggested structure:

``` text
aninow/
├── index.html
├── schedule.html
├── anime.html
├── about.html
├── privacy.html
├── AGENTS.md
├── DESIGN.md
├── PRD.md
├── LICENSE
├── assets/fonts/
├── assets/icons/
├── css/
├── js/
└── functions/api/
```

Keep the source understandable and maintainable.

## No-CDN rule

Do not use CDNs for fonts, CSS/JS frameworks, or icon libraries. Store
redistributable fonts locally and load with `@font-face`. API-provided
remote anime artwork is expected and exempt; do not commit copyrighted
anime artwork just to make it local.

## Theme

Support light/dark themes. Initial theme follows `prefers-color-scheme`;
manual toggle changes the current browsing session. Persistent theme
storage is not required.

## Data integrity

Never invent scores, `scored_by`, studios, broadcast times, episodes, or
MAL statistics. All anime data shown as factual must come from the
normalized API.

Jikan is unofficial and AniNow must not imply affiliation or endorsement
by MyAnimeList or Jikan.

## Licensing

AniNow is released under the MIT License. Do not assume API consumption
forces AniNow to inherit Jikan's software license. Preserve
licenses/notices for any vendored code, fonts, or icons.

## UX quality

Every visible control must work: filters, sorting, in-dataset search,
Load More, theme toggle, Refresh, navigation, detail links, and external
MAL links.

Provide skeleton loading, friendly error + Retry, last successful update
when available, stale-data indication when applicable, and useful empty
states.

## Accessibility

Use semantic elements, labels, keyboard-accessible controls, visible
focus states, sufficient contrast, meaningful alt text, reduced-motion
support, and text alongside status colors.

## Responsive design

Desktop uses a dense vertical ranking list. Tablet reduces secondary
metadata. Mobile deliberately recomposes each row into a compact
readable item; do not shrink a desktop table or cause page-level
horizontal scrolling.

## Anti-slop workflow

AniNow must not look like a generic AI SaaS page. For UI work: 1. Read
`DESIGN.md`. 2. Use its product-specific direction. 3. Audit for generic
AI defaults. 4. Keep glassmorphism only where `DESIGN.md` gives it a
purpose.

Anti-slop is a filter, not permission to make the site sterile.

## Working rules

Before editing, inspect existing code and relevant specs. Preserve
unrelated working behavior. Avoid unrelated redesigns/refactors. Test
affected API states and responsive states.

Priority on conflict: 1. Current explicit user request 2. `PRD.md` for
product/data behavior 3. `DESIGN.md` for visual direction 4. `AGENTS.md`
for engineering conventions

**Build an anime-fan product, not a portfolio-shaped demo.**
