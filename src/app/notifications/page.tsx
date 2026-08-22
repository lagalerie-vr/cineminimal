'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import FriendAvatar from '@/components/FriendAvatar';
import {
  getNotifications,
  markRead,
  markAllRead,
  clearNotification,
  clearAllNotifications,
  describeNotification,
  notificationHref,
  type AppNotification,
} from '@/lib/notifications';
import { timeAgo } from '@/lib/posts';
import {
  Bell,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCheck,
  Trash2,
  X,
} from 'lucide-react';

/** Full notification history — the dropdown only shows the most recent few. */
export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getNotifications(100));
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load notifications.');
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
  }, [authLoading, user, load]);

  const unread = items.filter((i) => !i.read_at).length;

  const readAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    try {
      await markAllRead();
    } catch {
      load();
    }
  };

  const removeOne = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await clearNotification(id);
    } catch {
      load();
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all notifications? This cannot be undone.')) return;
    setBusy(true);
    setItems([]);
    try {
      await clearAllNotifications();
    } catch (err: any) {
      setError(err?.message ?? 'Could not clear notifications.');
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
        <Bell size={64} className="text-white/10" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted max-w-sm">Sign in to see your activity.</p>
        </div>
        <Link
          href="/login?redirect=/notifications"
          className="bg-accent text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 transition-all"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-6 max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-accent/20 border border-accent/20 rounded-2xl flex items-center justify-center text-accent">
              <Bell size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Notifications</h1>
              <p className="text-muted text-sm">
                {items.length} total{unread > 0 && ` · ${unread} unread`}
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={readAll}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-bold hover:text-white hover:bg-white/10 transition-all"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={clearAll}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 disabled:opacity-40 transition-all"
            >
              {busy ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              <span>Clear all</span>
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-24 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 text-white/20">
              <Bell size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Nothing here</h3>
              <p className="text-muted max-w-xs mx-auto text-sm">
                Reactions, comments and friend activity will show up here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors group/n ${
                  n.read_at
                    ? 'bg-white/[0.02] border-white/5'
                    : 'bg-accent/[0.06] border-accent/20'
                }`}
              >
                <Link
                  href={notificationHref(n)}
                  onClick={() => !n.read_at && markRead(n.id).catch(() => {})}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  {n.actor ? (
                    <FriendAvatar profile={n.actor} size={40} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white/80 leading-snug">{describeNotification(n)}</p>
                    <p className="text-[10px] text-muted mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </Link>

                {!n.read_at && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}

                <button
                  onClick={() => removeOne(n.id)}
                  className="p-1.5 rounded-lg text-white/20 hover:text-red-400 opacity-0 group-hover/n:opacity-100 transition-all shrink-0"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
