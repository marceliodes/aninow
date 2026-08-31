import { escapeHtml, fetchJson, formatDate, formatNumber, safeImageUrl, safeMalUrl, setupFreshness, showState } from './app.js';

const article = document.querySelector('#anime-detail');
const stateBox = document.querySelector('#detail-state');
const id = new URLSearchParams(location.search).get('id');
let stopCountdown = () => {};
let hasSuccessfulDetail = false;

function fact(label, value) { return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? 'Unknown')}</dd></div>`; }

function setMeta(attribute, key, value) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.append(element); }
  element.content = value;
}

function render(item, meta) {
  const image = safeImageUrl(item.image);
  const malUrl = safeMalUrl(item.malUrl, item.malId);
  document.title = `${item.title} — AniNow`;
  document.querySelector('meta[name="description"]').content = `${item.title}: score, broadcast information, synopsis, and AniNow rank.`;
  setMeta('property', 'og:title', `${item.title} — AniNow`);
  setMeta('property', 'og:description', item.synopsis || `${item.title}: score, broadcast information, and AniNow rank.`);
  setMeta('name', 'twitter:title', `${item.title} — AniNow`);
  setMeta('name', 'twitter:description', item.synopsis || `${item.title}: score, broadcast information, and AniNow rank.`);
  if (image) { setMeta('property', 'og:image', image); setMeta('name', 'twitter:image', image); }
  document.querySelector('#crumb-title').textContent = item.title;
  article.innerHTML = `<div class="detail-cover">${image ? `<img src="${escapeHtml(image)}" alt="Cover art for ${escapeHtml(item.title)}" width="260" height="390">` : '<span aria-label="Cover art unavailable"></span>'}</div><div class="detail-body"><p class="detail-kicker">${escapeHtml(item.type || 'Anime')} · ${escapeHtml(item.status || 'Status unknown')}${meta.stale ? ' · Stale data' : ''}</p><h1 class="detail-title">${escapeHtml(item.title)}</h1>${item.titleRomaji && item.titleRomaji !== item.title ? `<p class="detail-romaji" lang="ja-Latn">${escapeHtml(item.titleRomaji)}</p>` : ''}<div class="detail-scorebar"><div class="big-score"><strong>${item.score?.toFixed(2) ?? '—'}</strong><small>${item.score ? `MAL score · ${formatNumber(item.scoredBy)} votes` : 'Not scored yet'}</small></div><div class="rank-stat"><strong>${item.aniNowRank ? `#${item.aniNowRank}` : '—'}</strong><small>Best-effort AniNow rank</small></div></div><div class="detail-tags">${item.genres.length ? item.genres.map(value => `<span class="tag">${escapeHtml(value)}</span>`).join('') : '<span class="tag">Genres unknown</span>'}</div><p class="detail-synopsis">${escapeHtml(item.synopsis || 'A synopsis is not available for this title.')}</p><dl class="detail-facts">${fact('Studio', item.studios.join(', ') || 'Unknown')}${fact('Episodes', item.episodes || 'Unknown')}${fact('Broadcast', item.broadcastDay ? `${item.broadcastDay}${item.broadcastTime ? ` at ${item.broadcastTime}` : ''}${item.broadcastTimezone ? ` (${item.broadcastTimezone})` : ''}` : 'Unknown')}${fact('Season', item.season && item.year ? `${item.season[0].toUpperCase()}${item.season.slice(1)} ${item.year}` : item.year || 'Unknown')}${fact('Aired from', formatDate(item.airedFrom))}${fact('Aired to', formatDate(item.airedTo))}</dl>${malUrl ? `<a class="external-link" href="${escapeHtml(malUrl)}" target="_blank" rel="noopener noreferrer">View on MyAnimeList <span aria-hidden="true">↗</span></a>` : ''}</div>`;
  article.setAttribute('aria-busy', 'false');
}

async function load() {
  stateBox.hidden = true;
  article.hidden = false;
  if (!/^[1-9]\d*$/.test(id || '')) {
    article.hidden = true;
    document.querySelector('.detail-freshness').hidden = true;
    showState(stateBox, { title: 'Invalid anime link', message: 'This detail page needs a positive numeric anime ID.' });
    document.querySelector('[data-refresh]')?.removeAttribute('disabled');
    return;
  }
  try {
    const payload = await fetchJson(`/api/anime/${id}`);
    render(payload.data, payload.meta);
    hasSuccessfulDetail = true;
    stopCountdown();
    stopCountdown = setupFreshness(payload.meta, { onExpire: load });
  } catch (error) {
    if (hasSuccessfulDetail && error.retryable !== false) {
      showState(stateBox, {
        title: 'Latest refresh failed',
        message: `${error.message} The last successfully loaded anime details are still shown.`,
        retry: error.retryable === false ? null : load,
        compact: true,
        warning: true
      });
      return;
    }
    stopCountdown();
    stopCountdown = () => {};
    article.hidden = true;
    showState(stateBox, { title: error.status === 404 ? 'Anime unavailable' : 'Details could not load', message: error.message, retry: error.retryable === false ? null : load, error: true });
  }
  finally { document.querySelector('[data-refresh]')?.removeAttribute('disabled'); }
}

document.addEventListener('aninow:refresh', load);
load();
