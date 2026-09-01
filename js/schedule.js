import { escapeHtml, fetchJson, safeImageUrl, setupFreshness, showState } from './app.js';
import { detectVisitorTimeZone, localBroadcast } from './broadcast-time.js';

const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const board = document.querySelector('#schedule-board');
const stateBox = document.querySelector('#schedule-state');
let stopFreshness = () => {};
let hasSuccessfulSchedule = false;

function entryMarkup(item) {
  const image = safeImageUrl(item.image);
  return `<a class="schedule-entry" href="/anime.html?id=${item.malId}">${image ? `<img src="${escapeHtml(image)}" alt="" width="38" height="57" loading="lazy">` : '<span aria-hidden="true"></span>'}<span class="schedule-title">${escapeHtml(item.title)}<small>${escapeHtml(item.titleRomaji && item.titleRomaji !== item.title ? item.titleRomaji : item.studio || 'Studio unknown')}</small></span><span class="schedule-time">${escapeHtml(item.localBroadcast.time)}</span><span class="schedule-meta">${escapeHtml(item.type || 'Unknown')} · ${escapeHtml(item.status || 'Status unknown')}</span></a>`;
}

function render(items) {
  const localizedItems = items.map(item => ({ ...item, localBroadcast: localBroadcast(item) }));
  const byDay = Object.groupBy(localizedItems, item => item.localBroadcast.day);
  const sections = [...days, 'Unknown'].map(day => {
    const entries = (byDay[day] || []).sort((a, b) => a.localBroadcast.sortKey - b.localBroadcast.sortKey || a.title.localeCompare(b.title));
    return `<section class="schedule-day"><header class="day-heading"><h2>${day}</h2><span>${entries.length} title${entries.length === 1 ? '' : 's'}</span></header><div class="day-entries">${entries.length ? entries.map(entryMarkup).join('') : '<p class="empty-day">No eligible broadcasts listed.</p>'}</div></section>`;
  });
  board.innerHTML = sections.join('');
  board.setAttribute('aria-busy', 'false');
  const timeZone = detectVisitorTimeZone();
  document.querySelector('#timezone-label').textContent = timeZone
    ? `Times shown in your local timezone: ${timeZone}`
    : 'Times shown in your local timezone';
}

async function load() {
  stateBox.hidden = true;
  try {
    const payload = await fetchJson('/api/schedule');
    render(payload.data);
    hasSuccessfulSchedule = true;
    stopFreshness();
    stopFreshness = setupFreshness(payload.meta, { onExpire: load });
  } catch (error) {
    if (hasSuccessfulSchedule && error.retryable !== false) {
      showState(stateBox, {
        title: 'Latest refresh failed',
        message: `${error.message} The last successfully loaded schedule is still shown.`,
        retry: error.retryable === false ? null : load,
        compact: true,
        warning: true
      });
      return;
    }
    board.innerHTML = '';
    board.setAttribute('aria-busy', 'false');
    showState(stateBox, { title: 'The schedule missed its cue', message: error.message, retry: error.retryable === false ? null : load, error: true });
  }
}

load();
