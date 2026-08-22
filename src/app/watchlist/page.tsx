'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import MovieCard from '@/components/MovieCard';
import { Bookmark, Users } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import TabStrip from '@/components/ui/TabStrip';
import { PageSpinner, SignInPrompt } from '@/components/ui/AuthGate';
import SharedWatchlistsOverview from '@/components/SharedWatchlistsOverview';
import Link from 'next/link';

type Tab = 'mine' | 'shared';

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('mine');
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

  if (authLoading || loading) return <PageSpinner />;

  if (!user) {
    return (
      <SignInPrompt
        icon={Bookmark}
        title="Your Watchlist is Private"
        body="Sign in to save your favorite movies and TV shows across all your devices."
        redirectTo="/watchlist"
      />
    );
  }

  return (
    <PageShell
      icon={Bookmark}
      title="Your Watchlist"
      subtitle={`${items.length} titles saved`}
      width="wide"
    >
        <TabStrip
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: 'mine', label: 'Mine', icon: Bookmark },
            { key: 'shared', label: 'Shared', icon: Users },
          ]}
        />

        {tab === 'shared' ? (
          <SharedWatchlistsOverview />
        ) : items.length > 0 ? (
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
          <EmptyState
            icon={Bookmark}
            title="Your watchlist is empty"
            body="Add movies and shows you want to watch later and they'll appear here."
            action={
              <Link href="/movies" className="inline-block text-accent font-bold hover:underline">
                Explore Movies
              </Link>
            }
          />
        )}
    </PageShell>
  );
}
