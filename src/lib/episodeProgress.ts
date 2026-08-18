// Per-show episode progress, kept in localStorage so resume position and
// watched marks work without requiring the viewer to be signed in.

const STORAGE_PREFIX = 'cm_progress_';

interface ShowProgress {
  watched: Record<string, true>; // key: `${season}-${episode}`
  lastSeason: number;
  lastEpisode: number;
  updatedAt: number;
}

const storageKey = (showId: string | number) => `${STORAGE_PREFIX}${showId}`;
const episodeKey = (season: number, episode: number) => `${season}-${episode}`;

function readProgress(showId: string | number): ShowProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(showId));
    return raw ? (JSON.parse(raw) as ShowProgress) : null;
  } catch {
    return null;
  }
}

function writeProgress(showId: string | number, data: ShowProgress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(showId), JSON.stringify(data));
  } catch {
    // Storage unavailable or full — fail silently, progress just won't persist.
  }
}

export function getShowProgress(showId: string | number): ShowProgress {
  return readProgress(showId) || { watched: {}, lastSeason: 1, lastEpisode: 1, updatedAt: 0 };
}

export function getLastPosition(showId: string | number): { season: number; episode: number } | null {
  const p = readProgress(showId);
  return p ? { season: p.lastSeason, episode: p.lastEpisode } : null;
}

export function setLastPosition(showId: string | number, season: number, episode: number) {
  const p = getShowProgress(showId);
  p.lastSeason = season;
  p.lastEpisode = episode;
  p.updatedAt = Date.now();
  writeProgress(showId, p);
}

export function isEpisodeWatched(showId: string | number, season: number, episode: number): boolean {
  return !!readProgress(showId)?.watched[episodeKey(season, episode)];
}

export function markEpisodeWatched(showId: string | number, season: number, episode: number) {
  const p = getShowProgress(showId);
  p.watched[episodeKey(season, episode)] = true;
  p.updatedAt = Date.now();
  writeProgress(showId, p);
}

export function toggleEpisodeWatched(showId: string | number, season: number, episode: number) {
  const p = getShowProgress(showId);
  const key = episodeKey(season, episode);
  if (p.watched[key]) delete p.watched[key];
  else p.watched[key] = true;
  p.updatedAt = Date.now();
  writeProgress(showId, p);
}

export function getWatchedKeys(showId: string | number): Set<string> {
  return new Set(Object.keys(getShowProgress(showId).watched));
}
