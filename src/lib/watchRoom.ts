import { supabase } from './supabase';
import { currentUserId, requireUserId } from './session';
import { fetchProfiles, type PublicProfile } from './friends';

/**
 * Watch rooms coordinate a shared viewing; they do NOT control anyone's
 * player. The streams are cross-origin third-party iframes with no
 * inbound command API, so remote play/pause/seek is impossible — browsers
 * forbid reaching into them by design.
 *
 * What's real: a shared countdown, and everyone reporting their own
 * position so the UI can show drift.
 */

export interface WatchRoom {
  id: string;
  code: string;
  host_id: string;
  media_type: 'movie' | 'tv';
  media_id: string;
  title: string;
  poster_path: string | null;
  season: number | null;
  episode: number | null;
  starts_at: string | null;
  created_at: string;
}

export type PositionSource = 'measured' | 'estimated';

export interface RoomMember {
  user_id: string;
  position_seconds: number;
  duration_seconds: number | null;
  /**
   * 'measured' comes from the provider's own progress broadcast.
   * 'estimated' is a local clock anchored to a shared start — right
   * until someone pauses, seeks or buffers, which it cannot see.
   */
  position_source: PositionSource;
  updated_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: PublicProfile | null;
}

/** Position reports below this gap aren't worth flagging as drift. */
export const DRIFT_TOLERANCE_SECONDS = 5;

/** Short, unambiguous room code — no 0/O or 1/I to mistype. */
function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
}

export interface CreateRoomInput {
  mediaType: 'movie' | 'tv';
  mediaId: string | number;
  title: string;
  posterPath?: string | null;
  season?: number | null;
  episode?: number | null;
}

export async function createRoom(input: CreateRoomInput): Promise<WatchRoom> {
  const userId = await requireUserId();

  // Retry on the (very unlikely) code collision rather than failing.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('watch_rooms')
      .insert({
        code: makeCode(),
        host_id: userId,
        media_type: input.mediaType,
        media_id: String(input.mediaId),
        title: input.title,
        poster_path: input.posterPath ?? null,
        season: input.season ?? null,
        episode: input.episode ?? null,
      })
      .select()
      .single();

    if (!error) {
      const room = data as WatchRoom;
      await joinRoom(room.id);
      return room;
    }
    if (error.code !== '23505') throw error;
  }

  throw new Error('Could not create a room. Try again.');
}

export async function getRoomByCode(code: string): Promise<WatchRoom | null> {
  const { data, error } = await supabase
    .from('watch_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as WatchRoom) ?? null;
}

export async function joinRoom(roomId: string): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase
    .from('watch_room_members')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });
  if (error) throw error;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from('watch_room_members').delete().eq('room_id', roomId).eq('user_id', userId);
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  const { data, error } = await supabase.rpc('get_room_members', { target_room: roomId });
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    ...m,
    position_seconds: Number(m.position_seconds ?? 0),
    position_source: (m.position_source ?? 'estimated') as PositionSource,
    duration_seconds: m.duration_seconds == null ? null : Number(m.duration_seconds),
  }));
}

/** Reports your own playback position, measured or estimated. */
export async function reportPosition(
  roomId: string,
  positionSeconds: number,
  durationSeconds?: number | null,
  source: PositionSource = 'estimated'
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  await supabase.from('watch_room_members').upsert(
    {
      room_id: roomId,
      user_id: userId,
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds ?? null,
      position_source: source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_id,user_id' }
  );
}

/** Host-only: schedules a synchronized start a few seconds out. */
export async function scheduleStart(roomId: string, secondsFromNow = 5): Promise<void> {
  const startsAt = new Date(Date.now() + secondsFromNow * 1000).toISOString();
  const { error } = await supabase.from('watch_rooms').update({ starts_at: startsAt }).eq('id', roomId);
  if (error) throw error;
}

export async function getMessages(roomId: string): Promise<RoomMessage[]> {
  const { data, error } = await supabase
    .from('watch_room_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  const rows = (data ?? []) as Omit<RoomMessage, 'author'>[];
  const profiles = await fetchProfiles(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, author: profiles.get(r.user_id) ?? null }));
}

export async function sendMessage(roomId: string, body: string): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase
    .from('watch_room_messages')
    .insert({ room_id: roomId, user_id: userId, body: body.trim() });
  if (error) throw error;
}

/** Live room updates: member positions, chat, and the host's countdown. */
export function subscribeToRoom(roomId: string, onChange: () => void): () => void {
  const channel = supabase.channel(`room:${roomId}`);

  for (const table of ['watch_room_members', 'watch_room_messages', 'watch_rooms'] as const) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: table === 'watch_rooms' ? `id=eq.${roomId}` : `room_id=eq.${roomId}` },
      () => onChange()
    );
  }

  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function buildRoomUrl(code: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/watch/${code}`;
}

export function formatDrift(seconds: number): string {
  const abs = Math.abs(Math.round(seconds));
  if (abs < 60) return `${abs}s`;
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}m ${s}s`;
}
