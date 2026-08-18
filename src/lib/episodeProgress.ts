// Per-show episode progress, kept in localStorage so resume position and
// watched marks work without requiring the viewer to be signed in.

const STORAGE_PREFIX = 'cm_progress_';

export interface EpisodePosition {
  watched: number;  // seconds played
  duration: number; // total seconds
}

interface ShowProgress {
  watched: Record<string, true>; // completed episodes, key: `${season}-${episode}`
  positions: Record<string, EpisodePosition>; // playback position, same key
  lastSeason: number;
  lastEpisode: number;
  updatedAt: number;
}

// Counted as finished at this fraction — most episodes run credits at the end,
// so requiring 100% would mean almost nothing ever gets marked.
const COMPLETE_AT = 0.9;

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
  const stored = readProgress(showId);
  return {
    watched: stored?.watched || {},
    positions: stored?.positions || {}, // absent in records written before positions existed
    lastSeason: stored?.lastSeason ?? 1,
    lastEpisode: stored?.lastEpisode ?? 1,
    updatedAt: stored?.updatedAt ?? 0,
  };
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

export function getEpisodePositions(showId: string | number): Record<string, EpisodePosition> {
  return getShowProgress(showId).positions;
}

/**
 * Records real playback position reported by the player. Returns true if this
 * changed anything worth re-rendering — the caller polls once a second, so
 * unchanged reports should not churn state or storage.
 */
export function setEpisodePosition(
  showId: string | number,
  season: number,
  episode: number,
  watched: number,
  duration: number
): boolean {
  if (!(duration > 0) || !(watched >= 0)) return false;

  const p = getShowProgress(showId);
  const key = episodeKey(season, episode);
  const prev = p.positions[key];

  const completed = watched / duration >= COMPLETE_AT;
  const newlyCompleted = completed && !p.watched[key];
  // Ignore sub-second jitter so a paused player doesn't write every tick.
  const moved = !prev || Math.abs(prev.watched - watched) >= 1 || prev.duration !== duration;
  if (!moved && !newlyCompleted) return false;

  p.positions[key] = { watched, duration };
  if (completed) p.watched[key] = true;
  p.updatedAt = Date.now();
  writeProgress(showId, p);
  return true;
}
