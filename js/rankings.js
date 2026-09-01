import { escapeHtml, fetchJson, formatDate, formatNumber, safeImageUrl, setupFreshness, showState } from './app.js';
import { localBroadcast } from './broadcast-time.js';
import { filterAnime, isDefaultView, sortAnime } from './rankings-logic.js';

const list = document.querySelector('#ranking-list');
const featured = document.querySelector('#featured');
const stateBox = document.querySelector('#ranking-state');
const unrankedSection = document.querySelector('#unranked-section');
const unrankedList = document.querySelector('#unranked-list');
const loadMore = document.querySelector('#load-more');
const controls = document.querySelector('#ranking-controls');
let dataset = [];
let visible = 20;
let stopFreshness = () => {};
let hasSuccessfulDataset = false;

function showLoadingRows() {
  list.innerHTML = Array.from({ length: 5 }, () => '<div class="rank-row skeleton-row"></div>').join('');
  list.setAttribute('aria-busy', 'true');
}

const currentFilters = () => ({
  search: document.querySelector('#search').value,
  genre: document.querySelector('#genre-filter').value,
  day: document.querySelector('#day-filter').value,
  sort: document.querySelector('#sort').value
});

function statusText(item) {
  if (item.status === 'Finished Airing' && item.graceEndsAt) return `Finished · leaves ${formatDate(item.graceEndsAt, { month: 'short', day: 'numeric' })}`;
  return item.status || 'Status unknown';
}

function rowMarkup(item, unranked = false) {
  const image = safeImageUrl(item.image);
  const href = `/anime.html?id=${item.malId}`;
  return `<article class="rank-row"><div class="rank-number">${unranked ? '—' : `#${item.rank}`}</div><a class="cover-link" href="${href}" tabindex="-1" aria-hidden="true">${image ? `<img class="rank-cover" src="${escapeHtml(image)}" alt="" width="48" height="72" loading="lazy">` : '<span class="rank-cover"></span>'}</a><div class="rank-title"><a href="${href}">${escapeHtml(item.title)}</a>${item.titleRomaji && item.titleRomaji !== item.title ? `<div class="romaji" lang="ja-Latn">${escapeHtml(item.titleRomaji)}</div>` : ''}<div class="row-status ${item.status === 'Finished Airing' ? 'status-finished' : 'status-airing'}">${escapeHtml(statusText(item))}</div></div><div class="cell score-cell"><strong>${item.score?.toFixed(2) ?? '—'}</strong><span>${item.score ? `${formatNumber(item.scoredBy)} votes` : 'Unscored'}</span></div><div class="cell"><strong>${escapeHtml(item.studio || 'Unknown')}</strong><span>Studio</span></div><div class="cell"><strong>${escapeHtml(item.type || '—')}</strong><span>${item.episodes ? `${item.episodes} eps` : 'Episodes ?'}</span></div><div class="cell"><strong>${escapeHtml(item.localBroadcast.day)}</strong><span>${escapeHtml(item.localBroadcast.time)}</span></div><div class="cell"><strong>${formatNumber(item.members)}</strong><span>Members</span></div></article>`;
}

function featuredMarkup(item, index) {
  const image = safeImageUrl(item.image);
  return `<a class="featured-card" href="/anime.html?id=${item.malId}">${image ? `<img src="${escapeHtml(image)}" alt="Cover art for ${escapeHtml(item.title)}" width="74" height="111">` : '<span aria-hidden="true"></span>'}<span class="featured-info"><span class="featured-rank">RANK ${index + 1}</span><span class="featured-title">${escapeHtml(item.title)}</span><span class="featured-score"><span class="score-value">${item.score.toFixed(2)}</span><span class="score-label">MAL score</span></span></span></a>`;
}

function render() {
  if (!hasSuccessfulDataset) return;
  const filters = currentFilters();
  const filtered = sortAnime(filterAnime(dataset, filters), filters.sort);
  const ranked = filtered.filter(item => item.score != null);
  const unranked = filtered.filter(item => item.score == null).sort((a, b) => a.title.localeCompare(b.title));
  const defaultView = isDefaultView(filters);
  const displayRanked = defaultView ? ranked.slice(3) : ranked;
  const denseLimit = defaultView ? Math.max(0, visible - 3) : visible;
  featured.hidden = !defaultView || ranked.length === 0;
  featured.innerHTML = defaultView ? ranked.slice(0, 3).map(featuredMarkup).join('') : '';
  const topImage = defaultView ? safeImageUrl(ranked[0]?.image) : '';
  document.querySelector('.hero-art').style.backgroundImage = topImage ? `url("${topImage.replace(/["\\]/g, '')}")` : '';
  list.innerHTML = displayRanked.slice(0, denseLimit).map(item => rowMarkup(item)).join('');
  list.setAttribute('aria-busy', 'false');
  document.querySelector('#result-count').textContent = dataset.length === 0
    ? 'No eligible titles'
    : `${ranked.length} ranked · ${unranked.length} unranked`;
  loadMore.hidden = ranked.length <= visible;
  unrankedSection.hidden = unranked.length === 0;
  unrankedList.innerHTML = unranked.map(item => rowMarkup(item, true)).join('');
  document.querySelector('#unranked-count').textContent = `${unranked.length} title${unranked.length === 1 ? '' : 's'}`;
  stateBox.hidden = ranked.length + unranked.length > 0;
  if (!filtered.length) showState(stateBox, dataset.length === 0
    ? { title: 'No eligible titles right now', message: 'AniNow loaded successfully, but the current dataset is empty.' }
    : { title: 'No titles match', message: 'Try clearing a filter or using a different title search.' });
}

function populateGenres() {
  const select = document.querySelector('#genre-filter');
  [...new Set(dataset.flatMap(item => item.genres))].sort().forEach(genre => select.insertAdjacentHTML('beforeend', `<option>${escapeHtml(genre)}</option>`));
}

async function load() {
  stateBox.hidden = true;
  loadMore.hidden = true;
  if (!hasSuccessfulDataset) {
    document.querySelector('#result-count').textContent = '';
    unrankedSection.hidden = true;
    featured.hidden = true;
    showLoadingRows();
  }
  try {
    const payload = await fetchJson('/api/airing');
    if (!Array.isArray(payload.data)) throw new Error('AniNow received an incomplete ranking dataset.');
    dataset = payload.data.map(item => ({ ...item, localBroadcast: localBroadcast(item) }));
    hasSuccessfulDataset = true;
    if (document.querySelector('#genre-filter').options.length === 1) populateGenres();
    stopFreshness();
    stopFreshness = setupFreshness(payload.meta, { onExpire: load });
    render();
  } catch (error) {
    if (hasSuccessfulDataset && error.retryable !== false) {
      showState(stateBox, {
        title: 'Latest refresh failed',
        message: `${error.message} The last successfully loaded rankings are still shown.`,
        retry: error.retryable === false ? null : load,
        compact: true,
        warning: true
      });
      return;
    }
    stopFreshness();
    stopFreshness = () => {};
    hasSuccessfulDataset = false;
    dataset = [];
    list.innerHTML = '';
    list.setAttribute('aria-busy', 'false');
    loadMore.hidden = true;
    unrankedSection.hidden = true;
    document.querySelector('#result-count').textContent = '';
    featured.innerHTML = '';
    featured.hidden = true;
    document.querySelector('.hero-art').style.backgroundImage = '';
    showState(stateBox, { title: 'The rankings are taking a break', message: error.message, retry: error.retryable === false ? null : load, error: true });
  }
}

controls.addEventListener('input', () => { visible = 20; render(); });
controls.addEventListener('reset', () => setTimeout(() => { visible = 20; render(); }));
loadMore.addEventListener('click', () => { visible += 20; render(); loadMore.focus(); });
load();
