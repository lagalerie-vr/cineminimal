'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, Server, PlayCircle, Video as VideoIcon, Film, Tv, Play, Globe, Lightbulb, LightbulbOff, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface VideoPlayerProps {
  type: 'movie' | 'tv';
  id: string | number;
  imdbId?: string;
  season?: number;
  episode?: number;
  title?: string;
  posterPath?: string;
  videos?: any[];
  onProgress?: (position: { watched: number; duration: number }) => void;
}

const PROVIDERS = [
  { name: 'videasy', url: 'https://player.videasy.net', type: 'tmdb' },
  { name: 'vidsrc.sbs', url: 'https://vidsrc.sbs/embed', type: 'tmdb' },
  { name: 'vidsrc.to', url: 'https://vidsrc.to/embed', type: 'tmdb' },
  { name: 'vidsrc.me', url: 'https://vidsrc.me/embed', type: 'tmdb' },
];

const VideoPlayer = ({ 
  type, 
  id, 
  imdbId, 
  season = 1, 
  episode = 1, 
  title, 
  posterPath,
  videos = [],
  onProgress
}: VideoPlayerProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0]);
  const [lightsOff, setLightsOff] = useState(false);
  const [mounted, setMounted] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => setMounted(true), []);

  // Escape exits lights-off mode from anywhere on the page.
  useEffect(() => {
    if (!lightsOff) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightsOff(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightsOff]);

  useEffect(() => {
    if (!lightsOff) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [lightsOff]);

  // The player always lives in a portal on <body>, never inside the page's
  // nested stacking contexts, so theater mode is a plain z-index change rather
  // than a fight with ancestor z-indexes. It stays portaled in normal mode too:
  // moving an iframe between parents reloads it and restarts the stream.
  // `slot` below reserves the layout space and this tracks its geometry, in
  // document coordinates so normal scrolling moves the player with the page.
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, height: 0 });
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observer.observe(document.body); // content above the player shifting it down
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [mounted]);
  const [isVideoMode, setIsVideoMode] = useState(true); // true = movie/tv, false = trailer
  
  // Find primary trailer
  const primaryTrailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];
  const [currentTrailerKey, setCurrentTrailerKey] = useState<string | null>(primaryTrailer?.key || null);

  const [ytResults, setYtResults] = useState<any[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  // Record History
  useEffect(() => {
    if (!user || !isVideoMode) return;

    const recordHistory = async () => {
      try {
        await supabase.from('watch_history').upsert({
          user_id: user.id,
          movie_id: String(id),
          type: type,
          title: title,
          poster_path: posterPath,
          season: type === 'tv' ? season : null,
          episode: type === 'tv' ? episode : null,
          watched_at: new Date().toISOString(),
        }, { onConflict: 'user_id, movie_id' });
      } catch (err) {
        console.error('History record error:', err);
      }
    };

    const timer = setTimeout(recordHistory, 10000);
    return () => clearTimeout(timer);
  }, [user, id, type, season, episode, isVideoMode, posterPath, title]);

  // Videasy broadcasts its watch history to the parent once a second. It's
  // send-only (there's no inbound command channel), but it's enough to track
  // real playback position instead of guessing from elapsed wall time.
  // Providers that don't post anything simply never fire this.
  useEffect(() => {
    if (!onProgress) return;
    let providerOrigin: string;
    try {
      providerOrigin = new URL(activeProvider.url).origin;
    } catch {
      return;
    }

    const handler = (event: MessageEvent) => {
      // Any page can postMessage us; only trust the embed we actually loaded.
      if (event.origin !== providerOrigin) return;

      let envelope: any;
      try {
        envelope = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!envelope || envelope.type !== 'MEDIA_DATA') return;

      let history: any;
      try {
        history = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data;
      } catch {
        return;
      }
      if (!history || typeof history !== 'object') return;

      // Entries are keyed by an internal id, so match on the TMDB id they carry.
      const entry = Object.values<any>(history).find(
        (e) => e && String(e.id) === String(id)
      );
      if (!entry) return;

      const position =
        type === 'tv'
          ? entry.show_progress?.[`s${season}e${episode}`]?.progress
          : entry.progress;

      if (position && Number(position.duration) > 0) {
        onProgress({
          watched: Number(position.watched) || 0,
          duration: Number(position.duration),
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onProgress, activeProvider, id, type, season, episode]);

  // If a provider fails to load (dead domain, blocked request), the iframe's
  // onLoad never fires — clear the spinner so the user can switch servers.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(timer);
  }, [isLoading, activeProvider, isVideoMode, season, episode]);

  const fetchYoutubeResults = async () => {
    setYtLoading(true);
    setYtError(null);
    const query = `${title} ${type === 'tv' ? `S${season} E${episode}` : ''} full`;
    
    try {
      const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'API Key Missing') {
          // Open new tab as fallback
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
          return;
        }
        throw new Error(data.error || 'Failed to fetch');
      }
      
      setYtResults(data.results);
    } catch (err: any) {
      setYtError(err.message);
    } finally {
      setYtLoading(false);
    }
  };

  const getEmbedUrl = () => {
    if (!isVideoMode && currentTrailerKey) {
      return `https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1`;
    }

    // Check if we have an active YouTube selection
    if (activeProvider.name === 'YT_EMBED' && currentTrailerKey) {
      return `https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1`;
    }

    const base = activeProvider.url;
    const useId = (activeProvider.type === 'imdb' && imdbId) ? imdbId : id;
    
    if (type === 'movie') {
      if (activeProvider.name === 'vidsrc.in') return `${base}/${useId}/`;
      return `${base}/movie/${useId}`;
    } else {
      if (activeProvider.name === 'vidsrc.in') return `${base}/${useId}/${season}-${episode}/`;
      return `${base}/tv/${useId}/${season}/${episode}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Reserves the player's place in the page flow. The player itself is
          portaled to <body> so nothing caps its z-index. */}
      <div ref={slotRef} className="w-full aspect-video rounded-3xl bg-black border border-white/5" />

      {mounted && createPortal(
        <>
          {lightsOff && (
            <div
              className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-2xl cursor-pointer"
              onClick={() => setLightsOff(false)}
            />
          )}

          <div
            ref={playerRef}
            className="overflow-hidden bg-black shadow-2xl border border-white/5 group rounded-3xl"
            style={
              lightsOff
                ? {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(95vw, calc(88vh * 16 / 9))',
                    aspectRatio: '16 / 9',
                    zIndex: 9999,
                  }
                : {
                    // Document coordinates, so the page scrolls it naturally.
                    position: 'absolute',
                    top: box.top,
                    left: box.left,
                    width: box.width,
                    height: box.height,
                    zIndex: 30,
                  }
            }
          >
            {(isLoading || ytLoading) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                <Loader2 className="animate-spin text-accent mb-4" size={40} />
                <p className="text-muted text-sm font-medium uppercase tracking-widest">
                  {ytLoading ? 'Searching YouTube...' : (isVideoMode ? 'Initialising Stream...' : 'Loading Trailer...')}
                </p>
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={`${isVideoMode}-${currentTrailerKey}-${activeProvider.url}-${season}-${episode}`}
              src={getEmbedUrl()}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer"
              onLoad={() => {
                setIsLoading(false);
                setYtLoading(false);
              }}
              frameBorder="0"
            />

            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
              <button
                onClick={() => {
                  const el = playerRef.current;
                  if (!el) return;
                  if (document.fullscreenElement) document.exitFullscreen();
                  else el.requestFullscreen();
                }}
                className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-colors border border-white/10"
                title="Fullscreen"
              >
                <Maximize size={18} />
              </button>
              <button
                onClick={() => setLightsOff((v) => !v)}
                className={`p-2 backdrop-blur-md rounded-full transition-colors border ${
                  lightsOff
                    ? 'bg-accent/80 text-white border-accent'
                    : 'bg-black/60 text-white/70 hover:text-white border-white/10'
                }`}
                title={lightsOff ? 'Lights On' : 'Lights Off'}
              >
                {lightsOff ? <Lightbulb size={18} /> : <LightbulbOff size={18} />}
              </button>
              <button
                onClick={() => {
                  setIsLoading(true);
                  if (iframeRef.current) iframeRef.current.src = getEmbedUrl();
                }}
                className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-colors border border-white/10"
                title="Reload Player"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Mode & Provider Switching */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 shadow-lg">
          {/* Watch Mode Toggle */}
          <div className="flex items-center gap-2 p-1 bg-black/20 rounded-xl">
            <button
              onClick={() => {
                setIsLoading(true);
                setIsVideoMode(true);
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center space-x-2 ${
                isVideoMode 
                  ? 'bg-accent text-white shadow-lg' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <PlayCircle size={14} />
              <span>Watch Main</span>
            </button>
            
            {videos.length > 0 && (
              <button
                onClick={() => {
                  setIsLoading(true);
                  setIsVideoMode(false);
                }}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center space-x-2 ${
                  !isVideoMode 
                    ? 'bg-red-500 text-white shadow-lg' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                <VideoIcon size={14} />
                <span>Watch Trailer</span>
              </button>
            )}
          </div>

          {/* Server Selection */}
          {isVideoMode && (
            <div className="flex items-center gap-1.5 p-1 bg-black/20 rounded-xl overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-2 px-2 border-r border-white/10 opacity-40">
                <Server size={12} />
              </div>
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.url}
                  onClick={() => {
                    setIsLoading(true);
                    setActiveProvider(provider);
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    activeProvider.url === provider.url 
                      ? 'bg-white/10 text-white border border-white/20' 
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Community / Regional Sources (YouTube, DailyMotion, etc.) */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white/40">
              <Globe size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Regional & Alternative Sources</span>
            </div>
            {ytError && <span className="text-[8px] text-red-500 bg-red-500/10 px-2 py-1 rounded">Error: {ytError}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button 
              onClick={fetchYoutubeResults}
              disabled={ytLoading}
              className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all text-[11px] font-bold disabled:opacity-50"
            >
              <VideoIcon size={14} />
              <span>{ytLoading ? 'Searching...' : 'YouTube API Results'}</span>
            </button>

            <button 
              onClick={() => {
                const query = encodeURIComponent(`${title} ${type === 'tv' ? `S${season} E${episode}` : ''} complet`);
                window.open(`https://www.dailymotion.com/search/${query}`, '_blank');
              }}
              className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-all text-[11px] font-bold"
            >
              <VideoIcon size={14} />
              <span>Dailymotion</span>
            </button>

            <button 
              onClick={() => {
                const query = encodeURIComponent(`${title} ${type === 'tv' ? `season ${season} episode ${episode}` : ''} arabic stream`);
                window.open(`https://www.google.com/search?q=${query}`, '_blank');
              }}
              className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 hover:bg-orange-500/20 transition-all text-[11px] font-bold"
            >
              <Globe size={14} />
              <span>Arabic Search</span>
            </button>
          </div>

          {/* YouTube Results Grid */}
          <AnimatePresence>
            {ytResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5 scroll-mt-4"
              >
                {ytResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      setIsLoading(true);
                      setCurrentTrailerKey(result.id);
                      setIsVideoMode(true); // Treat as watch mode
                      setActiveProvider({ name: 'YT_EMBED', url: 'https://www.youtube.com/embed/', type: 'custom' });
                    }}
                    className="flex flex-col text-left group/card"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-2 border border-white/5 group-hover/card:border-accent transition-colors">
                      <Image 
                        src={result.thumbnail} 
                        alt={result.title} 
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover group-hover/card:scale-110 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <Play size={24} className="text-white fill-current" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-white line-clamp-2 mb-1 group-hover/card:text-accent transition-colors">{result.title}</span>
                    <span className="text-[8px] text-white/40 uppercase tracking-widest">{result.channelTitle}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          
          <p className="text-[10px] text-white/30 text-center italic">
            * Use these sources for Tunisian or Arabic series that may not be available on global servers.
          </p>
        </div>
      </div>

      {/* Internal Trailer Selector */}
      {!isVideoMode && videos.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-2 text-muted px-2">
            <VideoIcon size={16} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Trailers & Clips Menu</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {videos.slice(0, 10).map((video) => (
              <button
                key={video.id}
                onClick={() => {
                  if (currentTrailerKey !== video.key) {
                    setIsLoading(true);
                    setCurrentTrailerKey(video.key);
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  currentTrailerKey === video.key 
                    ? 'bg-red-500/20 border-red-500 text-red-500 shadow-lg' 
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
                }`}
              >
                {video.type === 'Trailer' ? <Play size={10} className="fill-current" /> : <Film size={10} />}
                <span className="max-w-[120px] truncate">{video.name}</span>
                <span className="text-[8px] opacity-40 px-1.5 py-0.5 rounded bg-white/10 group-hover:bg-white/20 transition-colors uppercase tracking-tighter">{video.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
