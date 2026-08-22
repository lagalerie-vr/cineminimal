import { supabase } from './supabase';
import { requireUserId } from './session';

export const DM_PAGE_SIZE = 40;

export interface DmThread {
  thread_id: string;
  other_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_body: string | null;
  last_sender_id: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface DmMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface DmCursor {
  created_at: string;
  id: string;
}

/** Every conversation you're in, most recent first. */
export async function getThreads(): Promise<DmThread[]> {
  const { data, error } = await supabase.rpc('get_dm_threads');
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    unread_count: Number(r.unread_count ?? 0),
  }));
}

/**
 * Find or create the thread with someone. Server-side this is
 * friends-only, so it throws for a stranger rather than silently
 * returning an unusable id.
 */
export async function openThread(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_dm', { other_id: otherId });
  if (error) throw error;
  return data as string;
}

/** Newest-first page. The view reverses for display. */
export async function getMessages(
  threadId: string,
  cursor?: DmCursor | null
): Promise<DmMessage[]> {
  const { data, error } = await supabase.rpc('get_dm_messages', {
    target_thread: threadId,
    before_created: cursor?.created_at ?? null,
    before_id: cursor?.id ?? null,
    page_size: DM_PAGE_SIZE,
  });
  if (error) throw error;
  return (data ?? []) as DmMessage[];
}

export async function sendMessage(threadId: string, body: string): Promise<void> {
  const senderId = await requireUserId();
  const trimmed = body.trim();
  if (!trimmed) return;

  const { error } = await supabase
    .from('dm_messages')
    .insert({ thread_id: threadId, sender_id: senderId, body: trimmed });
  if (error) throw error;
}

export async function markRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_dm_read', { target_thread: threadId });
  if (error) throw error;
}

export async function getUnreadTotal(): Promise<number> {
  const threads = await getThreads();
  return threads.reduce((n, t) => n + t.unread_count, 0);
}

/**
 * Live messages.
 *
 * Filtered to one thread server-side — a plain `eq` filter, which is the
 * reliable kind here. Without `threadId` it listens to every dm_messages
 * change the subscriber can see, which is what the thread list wants.
 */
export function subscribeToMessages(
  onChange: (message: DmMessage | null) => void,
  threadId?: string
): () => void {
  // Unique per subscription. A fixed topic name returns the *existing*
  // channel on a second call, and adding callbacks to an already-subscribed
  // channel throws — which React's double-invoked effects trigger every
  // time in development.
  const channel = supabase
    .channel(`dm:${threadId ?? 'all'}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'dm_messages',
        ...(threadId ? { filter: `thread_id=eq.${threadId}` } : {}),
      },
      (payload) => onChange((payload.new as DmMessage) ?? null)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
