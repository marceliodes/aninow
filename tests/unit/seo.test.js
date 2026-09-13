import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const content = (html, pattern, label) => {
  const match = html.match(pattern);
  assert.ok(match, `${label} is missing`);
  return match[1];
};

test('indexable HTML pages have unique titles, descriptions, and clean static canonicals', async () => {
  const pages = [
    ['index.html', 'AniNow | Airing Anime Rankings', 'https://ani-now.pages.dev/'],
    ['schedule.html', 'AniNow | Weekly Anime Schedule', 'https://ani-now.pages.dev/schedule'],
    ['about.html', 'About | AniNow', 'https://ani-now.pages.dev/about'],
    ['privacy.html', 'Privacy | AniNow', 'https://ani-now.pages.dev/privacy'],
    ['anime.html', 'Anime Details | AniNow', null]
  ];
  const titles = [];
  const descriptions = [];
  for (const [path, expectedTitle, expectedCanonical] of pages) {
    const html = await read(path);
    const title = content(html, /<title>([^<]+)<\/title>/, `${path} title`);
    const description = content(html, /<meta name="description" content="([^"]+)"/, `${path} description`);
    assert.equal(title, expectedTitle);
    assert.ok(description.length >= 40, `${path} description is too weak`);
    titles.push(title);
    descriptions.push(description);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    assert.equal(canonical, expectedCanonical);
  }
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('robots, sitemap, and custom 404 expose only intended public routes', async () => {
  const [robots, sitemap, notFound] = await Promise.all([read('robots.txt'), read('sitemap.xml'), read('404.html')]);
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/ani-now\.pages\.dev\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /^Disallow:/im);

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations, [
    'https://ani-now.pages.dev/',
    'https://ani-now.pages.dev/schedule',
    'https://ani-now.pages.dev/about',
    'https://ani-now.pages.dev/privacy'
  ]);
  assert.equal(new Set(locations).size, locations.length);
  assert.doesNotMatch(sitemap, /(?:\.html|\/api\/|\/404(?:<|\/))/);

  assert.match(notFound, /<meta name="robots" content="noindex">/);
  assert.match(notFound, /<title>Page Not Found \| AniNow<\/title>/);
  assert.match(notFound, /<h1>That episode isn’t here\.<\/h1>/);
  assert.match(notFound, /<a class="primary-button" href="\/">Return to rankings<\/a>/);
});
