export function compareCanonical(a, b) {
  const scoreDiff = (b.score ?? -1) - (a.score ?? -1);
  if (scoreDiff) return scoreDiff;
  const votersDiff = (b.scoredBy ?? 0) - (a.scoredBy ?? 0);
  if (votersDiff) return votersDiff;
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

const titleFallback = (a, b) => compareCanonical(a, b) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

export function sortAnime(items, sort) {
  return [...items].sort((a, b) => {
    if (sort === 'popularity') {
      const av = a.popularity > 0 ? a.popularity : Infinity;
      const bv = b.popularity > 0 ? b.popularity : Infinity;
      return av - bv || titleFallback(a, b);
    }
    if (sort === 'members') return (b.members ?? 0) - (a.members ?? 0) || titleFallback(a, b);
    if (sort === 'newest') {
      const av = a.airedFrom ? new Date(a.airedFrom).getTime() : -Infinity;
      const bv = b.airedFrom ? new Date(b.airedFrom).getTime() : -Infinity;
      return bv - av || titleFallback(a, b);
    }
    if (sort === 'title') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || compareCanonical(a, b);
    return compareCanonical(a, b);
  });
}

export function filterAnime(items, filters) {
  const query = filters.search.trim().toLocaleLowerCase();
  return items.filter(item => {
    const day = item.broadcastDay ? item.broadcastDay.replace(/s$/, '') : 'Unknown';
    return (!query || [item.title, item.titleRomaji].some(value => value?.toLocaleLowerCase().includes(query))) &&
      (filters.genre === 'all' || item.genres.includes(filters.genre)) &&
      (filters.day === 'all' || day === filters.day);
  });
}

export function isDefaultView(filters) {
  return filters.search === '' && filters.genre === 'all' && filters.day === 'all' && filters.sort === 'score';
}
