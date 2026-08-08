'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import MovieCard from '@/components/MovieCard';
import { Bookmark, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user && !authLoading) {
      setLoading(false);
      return;
    }

    if (user) {
      const fetchWatchlist = async () => {
        const { data, error } = await supabase
          .from('watch_list')
          .select('*')
          .eq('user_id', user.id)
          .order('added_at', { ascending: false });

        if (data) setItems(data);
        setLoading(false);
      };

      fetchWatchlist();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6 px-6">
        <Bookmark size={64} className="text-white/10" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Your Watchlist is Private</h1>
          <p className="text-muted max-w-sm">Sign in to save your favorite movies and TV shows across all your devices.</p>
        </div>
        <Link href="/login" className="bg-accent text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 transition-all">
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-6 space-y-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-accent/20 border border-accent/20 rounded-2xl flex items-center justify-center text-accent">
              <Bookmark size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Your Watchlist</h1>
              <p className="text-muted text-sm">{items.length} titles saved</p>
            </div>
          </div>
          <Link href="/" className="hidden md:flex items-center space-x-2 text-muted hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {items.map((item: any) => (
              <MovieCard 
                key={item.id}
                id={item.movie_id}
                title={item.title}
                posterPath={item.poster_path}
                rating={0} // We don't store rating in watchlist usually, but we could
                date=""
                type={item.type}
              />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 text-white/20">
              <Bookmark size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Your watchlist is empty</h2>
              <p className="text-muted max-w-xs mx-auto text-sm">Add movies and shows you want to watch later and they'll appear here.</p>
            </div>
            <Link href="/movies" className="inline-block text-accent font-bold hover:underline">Explore Movies</Link>
          </div>
        )}
      </div>
    </div>
  );
}
