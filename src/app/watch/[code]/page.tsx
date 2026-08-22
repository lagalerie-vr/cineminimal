'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import VideoPlayer from '@/components/VideoPlayer';
import FriendAvatar from '@/components/FriendAvatar';
import UserLink from '@/components/UserLink';
import {
  getRoomByCode,
  joinRoom,
  leaveRoom,
  getRoomMembers,
  reportPosition,
  scheduleStart,
  getMessages,
  sendMessage,
  subscribeToRoom,
  buildRoomUrl,
  formatDrift,
  DRIFT_TOLERANCE_SECONDS,
  type WatchRoom,
  type RoomMember,
  type RoomMessage,
} from '@/lib/watchRoom';
import { timeAgo } from '@/lib/posts';
import {
  Popcorn,
  Loader2,
  Copy,
  Check,
  Send,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';

export default function WatchRoomPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? '';
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom] = useState<WatchRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasProgress, setHasProgress] = useState(false);

  // Latest reported position, so the heartbeat has something to send
  // even between progress events.
  const myPosition = useRef<{ watched: number; duration: number } | null>(null);

  // Fallback clock for providers that broadcast nothing. `at` is when the
  // anchor was taken, so the estimate is anchor + elapsed while playing.
  // It cannot see a pause, a seek or a buffering stall — hence the
  // explicit controls below, and the 'estimated' label on the readout.
  const [anchor, setAnchor] = useState<{ position: number; at: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [syncHint, setSyncHint] = useState<string | null>(null);

  const estimateAt = useCallback(
    (a: { position: number; at: number } | null, isPlaying: boolean) =>
      a === null ? null : a.position + (isPlaying ? (Date.now() - a.at) / 1000 : 0),
    []
  );

  const refresh = useCallback(async (roomId: string) => {
    const [m, msg] = await Promise.all([getRoomMembers(roomId), getMessages(roomId)]);
    setMembers(m);
    setMessages(msg);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    // Must clear `loading` here, not just bail: the spinner is checked
    // before the signed-out branch, so leaving it true makes the sign-in
    // screen unreachable and the page hangs forever.
    if (!user || !code) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const r = await getRoomByCode(code);
        if (cancelled) return;
        if (!r) {
          setRoom(null);
          return;
        }
        await joinRoom(r.id);
        if (cancelled) return;
        setRoom(r);
        await refresh(r.id);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Could not open this room.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, code, refresh]);

  // Live room state.
  useEffect(() => {
    if (!room) return;
    const unsubscribe = subscribeToRoom(room.id, () => {
      refresh(room.id).catch(() => {});
      getRoomByCode(code).then((r) => r && setRoom(r)).catch(() => {});
    });
    return unsubscribe;
  }, [room?.id, code, refresh]);

  // Leaving on unmount keeps the member list honest.
  useEffect(() => {
    if (!room) return;
    return () => {
      leaveRoom(room.id).catch(() => {});
    };
  }, [room?.id]);

  // Host countdown, ticking locally off the shared starts_at timestamp.
  useEffect(() => {
    if (!room?.starts_at) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((new Date(room.starts_at!).getTime() - Date.now()) / 1000);
      setCountdown(remaining > 0 ? remaining : null);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [room?.starts_at]);

  // Position heartbeat. A real reading from the provider always wins; the
  // estimated clock only fills in for the embeds that broadcast nothing.
  useEffect(() => {
    if (!room) return;
    const t = setInterval(() => {
      const measured = myPosition.current;
      if (measured) {
        reportPosition(room.id, measured.watched, measured.duration, 'measured').catch(() => {});
        return;
      }
      const est = estimateAt(anchor, playing);
      if (est !== null) {
        reportPosition(room.id, est, null, 'estimated').catch(() => {});
      }
    }, 5000);
    return () => clearInterval(t);
  }, [room?.id, anchor, playing, estimateAt]);

  // A countdown is a shared zero point, so treat it as one: when it
  // elapses everyone's estimate starts from the same instant without
  // anyone having to press anything.
  useEffect(() => {
    if (!room?.starts_at) return;
    const startMs = new Date(room.starts_at).getTime();
    const arm = () => {
      setAnchor({ position: 0, at: startMs });
      setPlaying(true);
    };
    const delay = startMs - Date.now();
    if (delay <= 0) {
      arm();
      return;
    }
    const t = setTimeout(arm, delay);
    return () => clearTimeout(t);
  }, [room?.starts_at]);

  // Re-anchor to someone else's position. We can't seek a cross-origin
  // embed, so this fixes the *readout* and tells you what to do by hand.
  const syncTo = (target: RoomMember) => {
    const mine = myPosition.current?.watched ?? estimateAt(anchor, playing) ?? 0;
    const delta = target.position_seconds - mine;
    setAnchor({ position: target.position_seconds, at: Date.now() });
    setPlaying(true);
    setSyncHint(
      Math.abs(delta) < 1
        ? 'Already together.'
        : `Skip ${delta > 0 ? 'forward' : 'back'} ${formatDrift(delta)} in your player.`
    );
    setTimeout(() => setSyncHint(null), 8000);
  };

  const copyLink = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(buildRoomUrl(room.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the input below is selectable.
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !room) return;
    setDraft('');
    try {
      await sendMessage(room.id, body);
      await refresh(room.id);
    } catch (err: any) {
      setError(err?.message ?? 'Could not send that message.');
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
        <Popcorn size={64} className="text-white/10" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Join the watch party</h1>
          <p className="text-muted max-w-sm">Sign in to watch along with your friends.</p>
        </div>
        <Link
          href={`/login?redirect=/watch/${encodeURIComponent(code)}`}
          className="bg-accent text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 transition-all"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6 px-6 text-center">
        <Popcorn size={56} className="text-white/10" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Room not found</h1>
          <p className="text-muted max-w-sm text-sm">
            No watch party is running under the code {code.toUpperCase()}.
          </p>
        </div>
        <Link href="/" className="text-accent font-bold hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  const isHost = room.host_id === user.id;
  const me = members.find((m) => m.user_id === user.id);
  const others = members.filter((m) => m.user_id !== user.id);

  return (
    <div className="pt-28 pb-20 min-h-screen">
      <div className="container mx-auto px-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 bg-accent/20 border border-accent/20 rounded-2xl flex items-center justify-center text-accent shrink-0">
              <Popcorn size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white tracking-tight truncate">{room.title}</h1>
              <p className="text-muted text-sm">
                Watch party · {members.length} {members.length === 1 ? 'person' : 'people'}
                {room.season != null && ` · S${room.season}E${room.episode ?? 1}`}
              </p>
            </div>
          </div>
          <Link
            href={`/${room.media_type}/${room.media_id}`}
            className="hidden md:flex items-center gap-2 text-muted hover:text-white transition-colors text-sm font-medium shrink-0"
          >
            <ArrowLeft size={16} />
            <span>Title page</span>
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Countdown overlays everything: it's the one moment everyone
            needs to act on simultaneously. */}
        {countdown !== null && (
          <div className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <p className="text-white/60 text-sm uppercase tracking-widest">Press play in</p>
            <p className="text-8xl font-bold text-accent tabular-nums">{countdown}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <VideoPlayer
              type={room.media_type}
              id={room.media_id}
              season={room.season ?? 1}
              episode={room.episode ?? 1}
              title={room.title}
              posterPath={room.poster_path ?? undefined}
              preferredProvider="videasy"
              onProgress={(p) => {
                myPosition.current = p;
                setHasProgress(true);
              }}
            />

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <p className="text-[11px] text-muted leading-relaxed">
                Everyone controls their own player — the streams come from third-party
                embeds that can&apos;t be controlled remotely. Use the countdown to start
                together, and the drift readout to stay in step.
              </p>
              {!hasProgress && (
                <p className="text-[11px] text-yellow-500/80 leading-relaxed">
                  Waiting for playback position. Only the <strong>videasy</strong> server
                  reports progress — on any other server the drift readout stays empty.
                </p>
              )}
              <div className="flex gap-2">
                <input
                  readOnly
                  value={buildRoomUrl(room.code)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/70 font-mono outline-none focus:border-accent/40"
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                {isHost && (
                  <button
                    onClick={() => scheduleStart(room.id, 5).catch(() => {})}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all whitespace-nowrap"
                  >
                    <Play size={14} />
                    <span>Start countdown</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Drift panel */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <h2 className="text-sm font-bold text-white px-1">In the room</h2>
              <div className="space-y-2">
                {members.map((m) => {
                  const isMe = m.user_id === user.id;
                  const drift = me ? m.position_seconds - me.position_seconds : 0;
                  const offBy = Math.abs(drift);
                  const known = m.position_seconds > 0 || isMe;

                  return (
                    <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <UserLink username={isMe ? null : m.username}>
                        <FriendAvatar profile={m} size={32} />
                      </UserLink>
                      <div className="min-w-0 flex-1">
                        <UserLink username={isMe ? null : m.username}>
                          <p className="text-xs font-bold text-white truncate hover:text-accent transition-colors">
                            {isMe ? 'You' : m.display_name || m.username}
                          </p>
                        </UserLink>
                        <p className="flex items-center gap-1 text-[10px] text-muted">
                          <span>
                            {!known
                              ? 'no position yet'
                              : isMe
                              ? 'reference'
                              : offBy <= DRIFT_TOLERANCE_SECONDS
                              ? 'in sync'
                              : `${formatDrift(drift)} ${drift > 0 ? 'ahead' : 'behind'}`}
                          </span>
                          {/* Say which kind of number this is. An estimate
                              that looks like a measurement is worse than no
                              number at all. */}
                          {known && m.position_source === 'estimated' && (
                            <span className="text-white/25">· est.</span>
                          )}
                        </p>
                      </div>

                      {!isMe && known && (
                        <>
                          <button
                            onClick={() => syncTo(m)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                            title={`Match ${m.display_name || m.username}'s position`}
                          >
                            <RefreshCw size={13} />
                          </button>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              offBy <= DRIFT_TOLERANCE_SECONDS ? 'bg-accent' : 'bg-yellow-500'
                            }`}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {syncHint && (
                <p className="px-3 py-2 rounded-xl bg-accent/10 border border-accent/20 text-[11px] text-accent">
                  {syncHint}
                </p>
              )}

              {/* Only worth showing when the provider tells us nothing —
                  with real progress these controls would fight the truth. */}
              {!hasProgress && (
                <div className="flex items-center gap-2 px-1">
                  <button
                    onClick={() => {
                      const current = estimateAt(anchor, playing) ?? 0;
                      setAnchor({ position: current, at: Date.now() });
                      setPlaying((v) => !v);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/70 hover:text-white transition-colors"
                  >
                    {playing ? <Pause size={11} /> : <Play size={11} />}
                    <span>{playing ? 'Pause timer' : 'Start timer'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setAnchor({ position: 0, at: Date.now() });
                      setPlaying(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/70 hover:text-white transition-colors"
                    title="Tell the room you just started from the beginning"
                  >
                    At 0:00
                  </button>
                </div>
              )}

              {others.length === 0 && (
                <p className="text-[11px] text-muted px-1">
                  Share the link above to bring friends in.
                </p>
              )}
            </div>

            {/* Chat */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden flex flex-col max-h-[26rem]">
              <p className="text-sm font-bold text-white px-4 py-3 border-b border-white/5">Chat</p>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[10rem]">
                {messages.length === 0 ? (
                  <p className="text-[11px] text-muted text-center py-6">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-2">
                      {m.author && (
                        <UserLink username={m.author.username}>
                          <FriendAvatar profile={m.author} size={26} />
                        </UserLink>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted">
                          <UserLink
                            username={m.author?.username}
                            className="font-bold hover:text-accent"
                          >
                            {m.author?.display_name || m.author?.username || 'Someone'}
                          </UserLink>{' '}
                          · {timeAgo(m.created_at)}
                        </p>
                        <p className="text-xs text-white/80 break-words">{m.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 p-3 border-t border-white/5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Say something…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-xs placeholder:text-white/30 focus:border-accent transition-all outline-none"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim()}
                  className="p-2 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
