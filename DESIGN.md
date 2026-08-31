# DESIGN.md --- AniNow

## Design thesis

AniNow should feel like a contemporary anime-ranking/broadcast site made
by an anime fan: information-dense, fast to scan, visually expressive
where it matters, restrained elsewhere.

The ranking layout is inspired by traditional vertical anime release
lists: artwork left, useful title/metadata center, score/status easy to
scan. Use otherwise-empty horizontal space for real information, not
decorative filler.

This is **not** a SaaS landing page.

## Anti-AI-slop filter

Avoid the recognizable default bundle: giant centered hero, vague
inspirational copy, purple/blue gradient text, three identical feature
cards, unnecessary bento grids, excessive pills, glass on every surface,
huge radii, meaningless stats, and fade-in animation everywhere.

Anti-slop is not a style. It rejects generic choices without purpose.
The result must still have personality rooted in anime ranking and
broadcast culture.

Glassmorphism is explicitly allowed where it serves a reason: keeping
featured ranking information readable while visually connected to
changing anime artwork.

## Brand

Name: **AniNow**.

Logo: clean `AniNow` wordmark with a small pink live/status dot. No
mascot required. No AI sparkle iconography.

Do not use "winning/losing" language that invites fandom-war framing.

Voice: concise, neutral, fan-friendly.

Hero direction:

> **What's airing? See who's on top.**

## Palette

Light mode: white/near-white background, near-black text, neutral
separators.

Primary pink: **`#FF5C8A`**.

Use pale pink for selected/hover surfaces. Pink should identify the
brand, not flood every surface.

Dark mode: dark charcoal rather than pure black; retain `#FF5C8A`.

Use restrained semantic colors for airing, recently finished, unknown,
and errors, always paired with text/icons.

## Typography

Use **Noto Sans JP** as the primary recommendation. It supports
Latin/Japanese text well and remains readable in dense ranking UI.

Host font files locally under `assets/fonts/`, obtained from a
legitimate redistributable source, and preserve required license
notices. Use weight/size/spacing for hierarchy rather than many font
families. Do not default to Inter.

## Density

Moderate information density is desirable. Users should compare several
titles per desktop viewport.

Use clear row separators, aligned metadata, restrained padding, and
stronger emphasis only for the top three. Avoid huge cards.

## Header

Compact navigation: - AniNow + live dot - Rankings - Schedule - About -
Theme toggle - Refresh

Privacy belongs in the footer.

## Hero

Keep it compact; ranking content should appear quickly.

Show the hero line, short explanation, last-updated time, `mm:ss`
refresh countdown, and freshness indicator.

## Dynamic #1 artwork

Use the current #1 anime artwork as a blurred atmospheric backdrop
behind the compact top/top-three region.

Implementation should be simple progressive enhancement: remote artwork,
heavy blur/dimming, strong overlay, neutral fallback. Never sacrifice
text contrast. Avoid canvas/color-extraction complexity unless later
justified.

## Glassmorphism

Use restrained glass only for top-three surfaces over the dynamic
artwork, and optionally header/overlay controls where transparency gives
spatial context. Standard leaderboard rows should not be glass.

Glass needs contrast, visible boundaries, restrained blur, and solid
fallback.

## Top three

Give #1--#3 slightly larger artwork, stronger rank numerals, more
breathing room, and subtle accent/glass treatment. Do not create a
game-show podium.

After #3, transition to the dense standard list.

## Ranking rows

Desktop vertical rows should prioritize: - rank - cover -
English/display title - romaji title - MAL score - `scored_by` -
studio - total episodes - next broadcast/day - type - status

Not every field has equal weight. Score must be immediately scannable.
Avoid making it look like a raw spreadsheet.

Recently finished titles stay in the same ranking for 14 days. Show a
restrained status such as `Finished · leaves AniNow in 9 days`.

## Not Ranked Yet

Keep eligible unscored anime in a separate, quieter block on the same
page, alphabetically sorted.

## Controls

Provide Genre, Airing day, Sort, and search-within-AniNow controls. The
dataset is TV-only, so do not add a meaningless Type selector. Use
straightforward controls rather than making everything a pill.

Initial ranked view shows 20; Load More reveals more.

## Schedule

Monday--Sunday should be easy to scan. Do not create seven giant
decorative panels. Entries link to AniNow detail pages.

## Anime detail

Prioritize titles, score/scored_by, status, studio, episode count,
broadcast, season/year, genres, synopsis, artwork, and external MAL
link. No embedded/autoplay trailer.

## About and privacy

About is editorial/methodological, not marketing-heavy. Explain
eligibility, ranking, 14-day grace, 30-minute cache, exclusions, and
attribution.

Privacy must match actual implementation. Do not invent legal claims or
analytics practices.

## Theme

Initial theme follows OS preference. Manual toggle is available;
persistence is not required. Avoid distracting full-page theme
animation.

## Motion

Allowed: skeleton shimmer, subtle top-three/update motion, small value
transitions, theme transition, live pulse, and normal control feedback.

Countdown updates every second as `mm:ss`.

Avoid scroll-jacking, particles, bouncing cards, or every row flying
into view. Respect `prefers-reduced-motion`.

## Loading/error

Use skeleton rows matching final geometry. On errors preserve useful
structure, explain plainly, show Retry, last successful update when
known, and stale-data status when relevant.

## Responsive

Desktop: dense aligned vertical list. Tablet: reduce secondary metadata.
Mobile: recompose into compact list/cards with rank + cover, titles,
score, critical metadata, and detail navigation. Do not horizontally
scroll the whole leaderboard.

## Imagery/icons

Anime artwork remains remote via API-provided URLs. Use stable
aspect-ratio containers and lazy loading.

Prefer small local SVGs/CSS/text symbols over an icon-library CDN.

## Final anti-slop test

Before shipping: - Could this unchanged UI belong to a crypto dashboard
or generic SaaS? If yes, redesign. - Does the first viewport immediately
communicate live anime ranking/broadcast data? - Is it easier to scan
than the sparse reference? - Does glass serve artwork/context rather
than decoration? - Are real data/states doing more visual work than
generic cards? - Does dark mode preserve the same identity?
