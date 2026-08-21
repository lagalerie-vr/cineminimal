'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, usePathname } from 'next/navigation';
import VideoPlayer from './VideoPlayer';
import MovieCard from './MovieCard';
import { Star, Calendar, Users, List, Bookmark, ChevronRight, Check } from 'lucide-react';
import { getImageUrl } from '@/lib/imageUrl';
import WatchlistButton from './WatchlistButton';
import ReviewSection from './ReviewSection';
import {
  getLastPosition,
  setLastPosition,
  toggleEpisodeWatched,
  getWatchedKeys,
  getEpisodePositions,
  setEpisodePosition,
  type EpisodePosition,
} from '@/lib/episodeProgress';

interface TVPlayerContainerProps {
  show: any;
}

const TVPlayerContainer = ({ show }: TVPlayerContainerProps) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Search params reflect the requested URL identically on server and client,
  // so it's safe to use them for the initial render (no hydration mismatch).
  // localStorage isn't available during SSR, so the "resume last episode"
  // fallback is applied after mount instead, in the effect below.
  const urlSeason = Number(searchParams.get('season'));
  const urlEpisode = Number(searchParams.get('episode'));
  const [position, setPosition] = useState(() =>
    urlSeason > 0 && urlEpisode > 0
      ? { season: urlSeason, episode: urlEpisode }
      : { season: 1, episode: 1 }
  );
  const { season: activeSeason, episode: activeEpisode } = position;

  // Watched marks are also client-only state; start empty (matches SSR) and
  // hydrate from localStorage after mount.
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());
  const [positions, setPositions] = useState<Record<string, EpisodePosition>>({});

  // Episode names/synopses aren't in the show payload — TMDB only includes
  // episode_count per season there — so the active season's episode list is
  // fetched separately whenever the season changes.
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tv-season?id=${show.id}&season=${activeSeason}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setSeasonEpisodes(data.episodes || []); })
      .catch(() => { if (!cancelled) setSeasonEpisodes([]); });
    return () => { cancelled = true; };
  }, [show.id, activeSeason]);

  const currentEpisodeData = seasonEpisodes.find((e: any) => e.episode_number === activeEpisode);

  const updateUrl = (season: number, episode: number) => {
    const url = `${pathname}?season=${season}&episode=${episode}`;
    window.history.replaceState(null, '', url);
  };

  const selectEpisode = (season: number, episode: number) => {
    setPosition({ season, episode });
    setLastPosition(show.id, season, episode);
    updateUrl(season, episode);
  };

  // On mount: if the URL didn't specify an episode, resume where the viewer
  // left off; either way, load the watched marks and make sure the URL
  // reflects the episode actually playing.
  useEffect(() => {
    if (!(urlSeason > 0 && urlEpisode > 0)) {
      const last = getLastPosition(show.id);
      if (last) {
        setPosition(last);
        updateUrl(last.season, last.episode);
      } else {
        updateUrl(1, 1);
      }
    }
    setWatchedKeys(getWatchedKeys(show.id));
    setPositions(getEpisodePositions(show.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.id]);

  // Real playback position from the player, reported about once a second.
  // setEpisodePosition marks the episode watched once it's far enough in and
  // returns false when nothing actually changed, so idle ticks cost nothing.
  const handleProgress = useCallback(
    ({ watched, duration }: { watched: number; duration: number }) => {
      if (!setEpisodePosition(show.id, activeSeason, activeEpisode, watched, duration)) return;
      setPositions(getEpisodePositions(show.id));
      setWatchedKeys(getWatchedKeys(show.id));
    },
    [show.id, activeSeason, activeEpisode]
  );

  const toggleWatched = (season: number, episode: number) => {
    toggleEpisodeWatched(show.id, season, episode);
    setWatchedKeys(getWatchedKeys(show.id));
  };

  const seasonsWithEpisodes = useMemo(
    () => show.seasons.filter((s: any) => s.season_number > 0),
    [show.seasons]
  );
  const totalEpisodes = useMemo(
    () => seasonsWithEpisodes.reduce((acc: number, s: any) => acc + s.episode_count, 0),
    [seasonsWithEpisodes]
  );
  const watchedCount = useMemo(
    () =>
      Array.from(watchedKeys).filter((key) => {
        const [s] = key.split('-').map(Number);
        return seasonsWithEpisodes.some((se: any) => se.season_number === s);
      }).length,
    [watchedKeys, seasonsWithEpisodes]
  );
  const progressPercent = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;

  const currentSeason = show.seasons.find((s: any) => s.season_number === activeSeason);
  const releaseYear = (show.first_air_date || '').split('-')[0];

  return (
    <div className="container mx-auto px-6 -mt-40 relative z-20 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Player and Details */}
        <div className="lg:col-span-2 space-y-8">
          <VideoPlayer 
            type="tv" 
            id={show.id} 
            imdbId={show.external_ids?.imdb_id} 
            season={activeSeason} 
            episode={activeEpisode} 
            title={show.name}
            posterPath={show.poster_path}
            videos={show.videos.results}
            onProgress={handleProgress}
          />
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <h1 className="text-4xl md:text-5xl font-bold text-white">{show.name}</h1>
                <div className="flex items-center space-x-4">
                  <WatchlistButton 
                    id={show.id} 
                    type="tv" 
                    title={show.name} 
                    posterPath={show.poster_path} 
                  />
                </div>
              </div>

              {currentEpisodeData && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-bold text-accent uppercase tracking-widest">
                    Season {activeSeason} · Episode {activeEpisode}
                  </p>
                  {currentEpisodeData.name && (
                    <h2 className="text-xl font-bold text-white">{currentEpisodeData.name}</h2>
                  )}
                  {currentEpisodeData.overview && (
                    <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
                      {currentEpisodeData.overview}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm font-medium text-muted">
                <div className="flex items-center space-x-1">
                  <Star className="text-yellow-500 fill-yellow-500" size={16} />
                  <span className="text-white">{show.vote_average.toFixed(1)}</span>
                </div>
                <div className="flex items-center space-x-1 text-accent">
                  <span>{show.number_of_seasons} Seasons</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar size={16} />
                  <span>{releaseYear}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {show.genres.map((genre: any) => (
                <span key={genre.id} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/80">
                  {genre.name}
                </span>
              ))}
            </div>

            {/* Episode Selector */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
                    <List size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Episodes</h3>
                </div>
                <select
                  value={activeSeason}
                  onChange={(e) => selectEpisode(Number(e.target.value), 1)}
                  className="bg-card border border-white/10 text-white text-sm rounded-xl px-4 py-2 focus:ring-2 focus:ring-accent outline-none"
                >
                  {seasonsWithEpisodes.map((s: any) => (
                    <option key={s.id} value={s.season_number}>
                      Season {s.season_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Overall show progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted">
                  <span>{watchedCount} of {totalEpisodes} episodes watched</span>
                  <span className="text-white/70">{progressPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {Array.from({ length: currentSeason?.episode_count || 0 }, (_, i) => i + 1).map((ep) => {
                  const key = `${activeSeason}-${ep}`;
                  const isActive = ep === activeEpisode;
                  const isWatched = watchedKeys.has(key);
                  const position = positions[key];
                  // Only meaningful mid-episode: 0% and "finished" are already
                  // conveyed by the tile's own styling.
                  const partial =
                    position && position.duration > 0 && !isWatched
                      ? Math.min(100, Math.round((position.watched / position.duration) * 100))
                      : 0;
                  return (
                    <button
                      key={ep}
                      onClick={() => selectEpisode(activeSeason, ep)}
                      className={`relative py-3 rounded-xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20'
                          : isWatched
                          ? 'bg-white/[0.03] border-white/5 text-white/30'
                          : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      EP {ep}
                      <span
                        role="button"
                        aria-label={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatched(activeSeason, ep);
                        }}
                        className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                          isWatched
                            ? 'bg-accent border-accent text-white'
                            : 'bg-black/60 border-white/10 text-transparent hover:text-white/40'
                        }`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {partial > 0 && (
                        <span className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-white/10 overflow-hidden">
                          <span
                            className="block h-full bg-accent/80"
                            style={{ width: `${partial}%` }}
                          />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-lg text-white/70 leading-relaxed max-w-3xl">
              {show.overview}
            </p>

            {/* Cast */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <Users size={20} className="text-accent" />
                <span>Top Cast</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {show.credits.cast.slice(0, 6).map((person: any) => (
                  <Link 
                    key={person.id} 
                    href={`/person/${person.id}`}
                    className="text-center space-y-2 group"
                  >
                    <div className="relative aspect-square rounded-full overflow-hidden bg-card border border-white/5 group-hover:border-accent transition-all duration-300">
                      <Image 
                        src={getImageUrl(person.profile_path, 'w185')} 
                        alt={person.name}
                        fill
                        sizes="100px"
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-accent transition-colors">{person.name}</p>
                      <p className="text-[10px] text-muted line-clamp-1">{person.character}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Reviews Section */}
            <ReviewSection reviews={show.reviews.results} />
          </div>
        </div>

        {/* Right Column: Recommendations & Ads */}
        <div className="space-y-8 flex flex-col">
          <h3 className="text-xl font-bold text-white tracking-tight pt-4">Similar Shows</h3>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
            {show.recommendations.results.slice(0, 4).map((rec: any) => (
              <MovieCard 
                key={rec.id}
                id={rec.id}
                title={rec.name}
                posterPath={rec.poster_path}
                rating={rec.vote_average}
                date={(rec.first_air_date || '').split('-')[0]}
                type="tv"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVPlayerContainer;
