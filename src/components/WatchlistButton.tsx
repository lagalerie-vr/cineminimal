'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck, Loader2, Plus, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';

interface WatchlistButtonProps {
  id: string | number;
  type: 'movie' | 'tv' | 'all';
  title: string;
  posterPath: string;
  variant?: 'full' | 'icon';
}

const WatchlistButton = ({ id, type, title, posterPath, variant = 'full' }: WatchlistButtonProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkWatchlist = async () => {
      const { data, error } = await supabase
        .from('watch_list')
        .select('id')
        .eq('user_id', user.id)
        .eq('movie_id', String(id))
        .single();
      
      if (data) setIsInWatchlist(true);
      setLoading(false);
    };

    checkWatchlist();
  }, [user, id]);

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push('/login');
      return;
    }

    setActionLoading(true);
    if (isInWatchlist) {
      await supabase
        .from('watch_list')
        .delete()
        .eq('user_id', user.id)
        .eq('movie_id', String(id));
      setIsInWatchlist(false);
    } else {
      await supabase.from('watch_list').insert({
        user_id: user.id,
        movie_id: String(id),
        type: type === 'all' ? ('movie' as any) : type,
        title,
        poster_path: posterPath,
      });
      setIsInWatchlist(true);
    }
    setActionLoading(false);
  };

  if (loading) return null;

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleWatchlist}
        disabled={actionLoading}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border shadow-lg ${
          isInWatchlist
            ? 'bg-accent border-accent text-white hover:scale-110'
            : 'bg-black/60 backdrop-blur-md border-white/10 text-white hover:bg-black/80 hover:scale-110'
        }`}
        title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
      >
        {actionLoading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : isInWatchlist ? (
          <Check size={16} strokeWidth={3} />
        ) : (
          <Plus size={16} strokeWidth={3} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleWatchlist}
      disabled={actionLoading}
      className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all border ${
        isInWatchlist
          ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
          : 'bg-white/5 border-white/10 text-white hover:border-white/20 hover:bg-white/10'
      }`}
    >
      {actionLoading ? (
        <Loader2 className="animate-spin" size={18} />
      ) : isInWatchlist ? (
        <>
          <BookmarkCheck size={18} />
          <span>In Watchlist</span>
        </>
      ) : (
        <>
          <Bookmark size={18} />
          <span>Add to Watchlist</span>
        </>
      )}
    </button>
  );
};

export default WatchlistButton;
