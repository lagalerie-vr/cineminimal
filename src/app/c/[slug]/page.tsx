'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import PostComposer from '@/components/PostComposer';
import PostFeed from '@/components/PostFeed';
import { getChannelBySlug, joinChannel, leaveChannel, type Channel } from '@/lib/channels';
import { Hash, Loader2, ArrowLeft, Users, MessageSquare, AlertCircle } from 'lucide-react';

export default function ChannelPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const { user, loading: authLoading } = useAuth();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedKey, setFeedKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setChannel(await getChannelBySlug(slug));
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load this channel.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  const toggleMembership = async () => {
    if (!channel) return;
    setBusy(true);
    const wasMember = channel.is_member;
    setChannel({
      ...channel,
      is_member: !wasMember,
      member_count: channel.member_count + (wasMember ? -1 : 1),
    });
    try {
      if (wasMember) await leaveChannel(channel.id);
      else await joinChannel(channel.id);
    } catch (err: any) {
      setError(err?.message ?? 'Could not update membership.');
      load();
    } finally {
      setBusy(false);
    }
  };

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
        <Hash size={64} className="text-white/10" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Channels are for members</h1>
          <p className="text-muted max-w-sm">Sign in to read and post in channels.</p>
        </div>
        <Link
          href={`/login?redirect=/c/${encodeURIComponent(slug)}`}
          className="bg-accent text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 transition-all"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6 px-6 text-center">
        <Hash size={56} className="text-white/10" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Channel not found</h1>
          <p className="text-muted max-w-sm text-sm">Nothing here goes by c/{slug}.</p>
        </div>
        <Link href="/friends?tab=channels" className="text-accent font-bold hover:underline">
          Browse channels
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-6 max-w-2xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            <div className="w-12 h-12 bg-accent/20 border border-accent/20 rounded-2xl flex items-center justify-center text-accent shrink-0">
              <Hash size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-white tracking-tight truncate">{channel.name}</h1>
              <p className="flex items-center gap-3 text-muted text-sm">
                <span>c/{channel.slug}</span>
                <span className="flex items-center gap-1">
                  <Users size={12} /> {channel.member_count}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={12} /> {channel.post_count}
                </span>
              </p>
            </div>
          </div>
          <Link
            href="/friends?tab=channels"
            className="hidden md:flex items-center space-x-2 text-muted hover:text-white transition-colors text-sm font-medium shrink-0"
          >
            <ArrowLeft size={16} />
            <span>All channels</span>
          </Link>
        </div>

        {channel.description && (
          <p className="text-sm text-white/70 leading-relaxed">{channel.description}</p>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={toggleMembership}
          disabled={busy}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            channel.is_member
              ? 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              : 'bg-accent border-accent text-white hover:bg-accent/90'
          }`}
        >
          {channel.is_member ? 'Joined — leave channel' : 'Join channel'}
        </button>

        {/* Anyone signed in may post: channels are public spaces, and
            gating the composer on membership just adds a step before the
            join people were going to do anyway. */}
        <PostComposer
          channelId={channel.id}
          onPosted={() => setFeedKey((k) => k + 1)}
          placeholder={`Post in ${channel.name}…`}
        />

        <PostFeed
          channelId={channel.id}
          refreshKey={feedKey}
          emptyTitle="Nothing posted here yet"
          emptyBody="Be the first to start a conversation in this channel."
        />
      </div>
    </div>
  );
}
