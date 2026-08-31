const page = typeof document !== 'undefined' ? document.body?.dataset.page || '' : '';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

export function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'cdn.myanimelist.net' ? url.href : '';
  } catch { return ''; }
}

export function safeMalUrl(value, malId) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /(^|\.)myanimelist\.net$/.test(url.hostname)) return url.href;
  } catch { /* fallback below */ }
  return Number.isInteger(malId) && malId > 0 ? `https://myanimelist.net/anime/${malId}` : '';
}

export function formatNumber(value) {
  return Number.isFinite(value) && value > 0 ? new Intl.NumberFormat().format(value) : 'Unknown';
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat(undefined, options).format(date);
}

export function countdownText(timestamp, now = Date.now()) {
  if (!timestamp) return '--:--';
  const seconds = Math.max(0, Math.ceil((new Date(timestamp).getTime() - now) / 1000));
  if (!Number.isFinite(seconds)) return '--:--';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function setupFreshness(meta, { onExpire } = {}) {
  const countdown = document.querySelector('#countdown');
  const status = document.querySelector('#freshness-status');
  const updated = document.querySelector('#last-updated');
  if (!countdown || !status || !updated) return () => {};
  status.textContent = meta.stale ? 'Stale data · retry scheduled' : 'Fresh AniNow dataset';
  status.classList.toggle('stale', Boolean(meta.stale));
  updated.textContent = `Updated ${formatDate(meta.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}`;
  const target = meta.stale && meta.retryAt ? meta.retryAt : meta.expiresAt;
  let fired = false;
  const tick = () => {
    countdown.textContent = countdownText(target);
    if (!fired && new Date(target).getTime() <= Date.now()) {
      fired = true;
      onExpire?.();
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

export async function fetchJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const raw = await response.text();
  let payload;
  try { payload = JSON.parse(raw); } catch {
    const error = new Error(response.status === 404
      ? 'AniNow’s API route is unavailable. Run the site with Wrangler so Pages Functions can execute.'
      : 'AniNow’s API returned a non-JSON response.');
    error.retryable = response.status >= 500;
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'AniNow could not load this data.');
    error.retryable = payload?.error?.retryable ?? response.status >= 500;
    error.status = response.status;
    throw error;
  }
  if (!payload || !('data' in payload) || !payload.meta) throw new Error('AniNow received an incomplete response.');
  return payload;
}

export function showState(element, { title, message, retry, error = false, compact = false, warning = false }) {
  element.hidden = false;
  element.className = `state-box${error ? ' error' : ''}${warning ? ' warning' : ''}${compact ? ' compact' : ''}`;
  element.setAttribute('role', error ? 'alert' : 'status');
  element.innerHTML = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${retry ? '<button class="primary-button" type="button" data-retry>Retry</button>' : ''}`;
  if (retry) element.querySelector('[data-retry]').addEventListener('click', retry);
}

function getStoredTheme() {
  try { return sessionStorage.getItem('aninow-theme'); } catch { return null; }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = document.querySelector('[data-theme-toggle]');
  if (button) {
    button.textContent = theme === 'dark' ? '☀' : '☾';
    button.setAttribute('aria-label', `Use ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
}

function initializeShell() {
  document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]').forEach(element => {
    if (element.content.startsWith('/')) element.content = new URL(element.content, location.origin).href;
  });
  const header = document.querySelector('[data-header]');
  if (header) header.innerHTML = `<div class="shell header-inner"><a class="brand" href="/index.html" aria-label="AniNow home">AniNow<span class="brand-dot" aria-hidden="true"></span></a><nav class="primary-nav" aria-label="Primary"><a href="/index.html" ${page === 'rankings' ? 'aria-current="page"' : ''}>Rankings</a><a href="/schedule.html" ${page === 'schedule' ? 'aria-current="page"' : ''}>Schedule</a><a href="/about.html" ${page === 'about' ? 'aria-current="page"' : ''}>About</a></nav><div class="header-actions"><button class="icon-button" type="button" data-theme-toggle aria-label="Toggle theme">◐</button></div></div>`;
  const footer = document.querySelector('[data-footer]');
  if (footer) footer.innerHTML = `<div class="shell footer-inner"><p class="footer-copy"><strong>AniNow</strong> · Anime data provided by MyAnimeList. AniNow is not affiliated with or endorsed by MyAnimeList.</p><nav class="footer-links" aria-label="Footer"><a href="/about.html">About</a><a href="/privacy.html">Privacy</a></nav></div>`;
  const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(getStoredTheme() || preferred);
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { sessionStorage.setItem('aninow-theme', theme); } catch { /* session storage is optional */ }
  });
}

if (typeof document !== 'undefined') initializeShell();
