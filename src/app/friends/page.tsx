'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import FriendAvatar from '@/components/FriendAvatar';
import FriendRequestButton, { type RelationshipStatus } from '@/components/FriendRequestButton';
import PostComposer from '@/components/PostComposer';
import PostFeed from '@/components/PostFeed';
import WatchingNow from '@/components/WatchingNow';
import ChannelList from '@/components/ChannelList';
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getMyInviteCode,
  buildInviteUrl,
  searchUsers,
  type Friend,
  type PendingRequest,
  type PublicProfile,
} from '@/lib/friends';
import {
  Users,
  Loader2,
  ArrowLeft,
  Search,
  Link2,
  Copy,
  Check,
  AlertCircle,
  MessageSquare,
  UserPlus,
  Hash,
} from 'lucide-react';

type Tab = 'feed' | 'people' | 'channels';

function FriendsPageInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab = rawTab === 'people' || rawTab === 'channels' ? rawTab : 'feed';

  // Bumped after the composer publishes so the feed refetches.
  const [feedKey, setFeedKey] = useState(0);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<PendingRequest[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, inc, out, code] = await Promise.all([
        getFriends(),
        getIncomingRequests(),
        getOutgoingRequests(),
        getMyInviteCode(),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
      setInviteCode(code);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your friends.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [user, authLoading, load]);

  // Debounced username search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchUsers(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Lets a search result render the right control without extra queries.
  const relationships = useMemo(() => {
    const map = new Map<string, { status: RelationshipStatus; requestId: string }>();
    friends.forEach((f) => map.set(f.profile.id, { status: 'friends', requestId: f.requestId }));
    incoming.forEach((r) => map.set(r.profile.id, { status: 'incoming', requestId: r.requestId }));
    outgoing.forEach((r) => map.set(r.profile.id, { status: 'outgoing', requestId: r.requestId }));
    return map;
  }, [friends, incoming, outgoing]);

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(buildInviteUrl(inviteCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, denied permission) —
      // the input below is selectable as a fallback either way.
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
        <Users size={64} className="text-white/10" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Watch with friends</h1>
          <p className="text-muted max-w-sm">
            Sign in to add friends, see what they&apos;re watching, and build shared watchlists.
          </p>
        </div>
        <Link
          href="/login?redirect=/friends"
          className="bg-accent text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 transition-all"
        >
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
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Friends</h1>
              <p className="text-muted text-sm">
                {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
                {incoming.length > 0 && ` · ${incoming.length} pending`}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="hidden md:flex items-center space-x-2 text-muted hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Tabs. Kept in the URL so the feed/people split is linkable and
            survives a refresh. */}
        <div className="flex items-center gap-2 p-1 bg-black/20 rounded-2xl w-fit">
          <Link
            href="/friends?tab=feed"
            scroll={false}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              tab === 'feed' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white'
            }`}
          >
            <MessageSquare size={14} />
            <span>Feed</span>
          </Link>
          <Link
            href="/friends?tab=channels"
            scroll={false}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              tab === 'channels' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white'
            }`}
          >
            <Hash size={14} />
            <span>Channels</span>
          </Link>
          <Link
            href="/friends?tab=people"
            scroll={false}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              tab === 'people' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white'
            }`}
          >
            <UserPlus size={14} />
            <span>People</span>
            {incoming.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white/20 text-white text-[10px] flex items-center justify-center">
                {incoming.length}
              </span>
            )}
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'feed' && (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <PostComposer onPosted={() => setFeedKey((k) => k + 1)} />
              <PostFeed
                refreshKey={feedKey}
                emptyTitle="Your feed is quiet"
                emptyBody="Post something, or add friends to see what they're watching."
              />
            </div>
            <div className="lg:sticky lg:top-28">
              <WatchingNow />
            </div>
          </div>
        )}

        {tab === 'channels' && <ChannelList />}

        {tab === 'people' && (
          <div className="space-y-12">
        {/* Invite link */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
              <Link2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Your invite link</h2>
              <p className="text-muted text-xs">
                Anyone who opens this link becomes your friend instantly — only share it with people you know.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteCode ? buildInviteUrl(inviteCode) : 'Generating…'}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 font-mono outline-none focus:border-accent/40"
            />
            <button
              onClick={copyInvite}
              disabled={!inviteCode}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Find people</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username…"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-accent focus:bg-white/[0.08] transition-all outline-none"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-white/40" size={18} />
            )}
          </div>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="text-muted text-sm px-1">No users found matching &ldquo;{query.trim()}&rdquo;.</p>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((profile) => {
                const rel = relationships.get(profile.id);
                return (
                  <PersonRow
                    key={profile.id}
                    profile={profile}
                    status={rel?.status ?? 'none'}
                    requestId={rel?.requestId}
                    onChanged={load}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              Friend requests <span className="text-accent">({incoming.length})</span>
            </h2>
            <div className="space-y-2">
              {incoming.map((r) => (
                <PersonRow
                  key={r.requestId}
                  profile={r.profile}
                  status="incoming"
                  requestId={r.requestId}
                  onChanged={load}
                />
              ))}
            </div>
          </div>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Sent requests</h2>
            <div className="space-y-2">
              {outgoing.map((r) => (
                <PersonRow
                  key={r.requestId}
                  profile={r.profile}
                  status="outgoing"
                  requestId={r.requestId}
                  onChanged={load}
                />
              ))}
            </div>
          </div>
        )}

        {/* Friends */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Your friends</h2>
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((f) => (
                <PersonRow
                  key={f.requestId}
                  profile={f.profile}
                  status="friends"
                  requestId={f.requestId}
                  onChanged={load}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 text-white/20">
                <Users size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">No friends yet</h3>
                <p className="text-muted max-w-xs mx-auto text-sm">
                  Search for a username above, or share your invite link to connect instantly.
                </p>
              </div>
            </div>
          )}
        </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FriendsPage() {
  // useSearchParams opts this subtree out of prerendering, so it needs a
  // Suspense boundary or the build fails on this route.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-accent" size={40} />
        </div>
      }
    >
      <FriendsPageInner />
    </Suspense>
  );
}

function PersonRow({
  profile,
  status,
  requestId,
  onChanged,
}: {
  profile: PublicProfile;
  status: RelationshipStatus;
  requestId?: string;
  onChanged: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <FriendAvatar profile={profile} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {profile.display_name || profile.username}
          </p>
          <p className="text-xs text-muted truncate">@{profile.username}</p>
        </div>
      </div>
      <FriendRequestButton
        profileId={profile.id}
        status={status}
        requestId={requestId}
        onChanged={onChanged}
      />
    </div>
  );
}
