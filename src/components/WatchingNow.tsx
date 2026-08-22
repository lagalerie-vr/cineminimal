'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FriendAvatar from './FriendAvatar';
import { getImageUrl } from '@/lib/imageUrl';
import {
  getFriendsWatching,
  subscribeToPresence,
  isFresh,
  STALE_AFTER_MS,
  type WatchingFriend,
} from '@/lib/presence';
import { Loader2, Tv as TvIcon, Film } from 'lucide-react';

interface WatchingNowProps {
  /** Rendered inline (friends tab) vs. as the floating dock. */
  variant?: 'panel' | 'dock';
  onCountChange?: (n: number) => void;
}

export function useFriendsWatching() {
  const [watching, setWatching] = useState<WatchingFriend[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setWatching(await getFriendsWatching());
    } catch {
      setWatching([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToPresence(load);

    // Rows expire by age rather than by an event, so re-filter on a timer
    // as well — otherwise someone who closed their tab would linger until
    // the next unrelated realtime message arrived.
    const sweep = setInterval(() => {
      setWatching((prev) => prev.filter((w) => isFresh(w.updated_at)));
    }, STALE_AFTER_MS / 3);

    return () => {
      unsubscribe();
      clearInterval(sweep);
    };
  }, [load]);

  return { watching, loading };
}

function watchHref(w: WatchingFriend) {
  return w.media_type === 'tv'
    ? `/tv/${w.media_id}${w.season ? `?season=${w.season}&episode=${w.episode ?? 1}` : ''}`
    : `/movie/${w.media_id}`;
}

function Row({ w }: { w: WatchingFriend }) {
  return (
    <Link
      href={watchHref(w)}
      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group/row"
    >
      <div className="relative shrink-0">
        <FriendAvatar profile={w} size={36} />
        {/* Pulsing dot: this is live data, and it should look like it. */}
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent ring-2 ring-card">
          <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-75" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white truncate">
          {w.display_name || w.username}
        </p>
        <p className="flex items-center gap-1 text-[10px] text-muted truncate">
          {w.media_type === 'tv' ? <TvIcon size={9} /> : <Film size={9} />}
          <span className="truncate group-hover/row:text-accent transition-colors">{w.title}</span>
          {w.season != null && w.episode != null && (
            <span className="shrink-0">· S{w.season}E{w.episode}</span>
          )}
        </p>
      </div>

      <div className="relative w-8 h-11 rounded-md overflow-hidden bg-card shrink-0">
        <Image
          src={getImageUrl(w.poster_path, 'w185')}
          alt={w.title}
          fill
          sizes="32px"
          className="object-cover"
        />
      </div>
    </Link>
  );
}

/** Inline list for the friends tab. */
const WatchingNow = ({ variant = 'panel', onCountChange }: WatchingNowProps) => {
  const { watching, loading } = useFriendsWatching();

  useEffect(() => {
    onCountChange?.(watching.length);
  }, [watching.length, onCountChange]);

  if (variant === 'dock') return null;

  return (
    <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-white">Watching now</h2>
        {watching.length > 0 && (
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
            {watching.length} live
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-white/30" size={18} />
        </div>
      ) : watching.length === 0 ? (
        <p className="text-xs text-muted px-1 py-2">
          No friends are watching anything right now.
        </p>
      ) : (
        <div className="space-y-1">
          {watching.map((w) => (
            <Row key={w.user_id} w={w} />
          ))}
        </div>
      )}
    </div>
  );
};

export { Row as WatchingRow };
export default WatchingNow;
