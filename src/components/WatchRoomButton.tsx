'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { createRoom } from '@/lib/watchRoom';
import { Loader2, Popcorn } from 'lucide-react';

interface WatchRoomButtonProps {
  mediaType: 'movie' | 'tv';
  mediaId: string | number;
  title: string;
  posterPath?: string | null;
  season?: number | null;
  episode?: number | null;
}

/** Starts a watch room for this title and sends the host into it. */
const WatchRoomButton = ({
  mediaType,
  mediaId,
  title,
  posterPath,
  season,
  episode,
}: WatchRoomButtonProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const start = async () => {
    setBusy(true);
    try {
      const room = await createRoom({
        mediaType,
        mediaId,
        title,
        posterPath: posterPath ?? null,
        season: season ?? null,
        episode: episode ?? null,
      });
      router.push(`/watch/${room.code}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={start}
      disabled={busy}
      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 disabled:opacity-50 transition-all"
      title="Watch together with friends"
    >
      {busy ? <Loader2 className="animate-spin" size={14} /> : <Popcorn size={14} />}
      <span>Watch party</span>
    </button>
  );
};

export default WatchRoomButton;
