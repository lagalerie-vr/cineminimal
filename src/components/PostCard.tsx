'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FriendAvatar from './FriendAvatar';
import PostReactions from './PostReactions';
import PostComments from './PostComments';
import { useAuth } from './AuthProvider';
import { getImageUrl } from '@/lib/imageUrl';
import { deletePost, timeAgo, type Post } from '@/lib/posts';
import {
  MessageCircle,
  Trash2,
  Users,
  Globe,
  ChevronDown,
  ChevronUp,
  Film,
  Tv as TvIcon,
  Hash,
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  onChanged: (post: Post) => void;
  onDeleted: (id: string) => void;
}

/** Same threshold ReviewSection uses for its Read More cutoff. */
const TRUNCATE_AT = 300;

const PostCard = ({ post, onChanged, onDeleted }: PostCardProps) => {
  const { user, isAdmin } = useAuth();
  const [expandedBody, setExpandedBody] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isMine = user?.id === post.user_id;
  // Moderators can remove anyone's post. RLS enforces this too — the
  // button only decides whether to offer the action.
  const canDelete = isMine || isAdmin;
  const isLong = post.body.length > TRUNCATE_AT;
  const shownBody = isLong && !expandedBody ? `${post.body.slice(0, TRUNCATE_AT)}…` : post.body;

  const author = {
    username: post.username,
    display_name: post.display_name,
    avatar_url: post.avatar_url,
  };

  const mediaHref =
    post.media_type === 'tv'
      ? `/tv/${post.media_id}${post.season ? `?season=${post.season}&episode=${post.episode ?? 1}` : ''}`
      : `/movie/${post.media_id}`;

  const remove = async () => {
    setDeleting(true);
    try {
      await deletePost(post.id);
      onDeleted(post.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/u/${post.username}`}>
            <FriendAvatar profile={author} size={40} />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/u/${post.username}`}
              className="text-sm font-bold text-white hover:text-accent transition-colors"
            >
              {post.display_name || post.username}
            </Link>
            <p className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest">
              <span>{timeAgo(post.created_at)}</span>
              <span>·</span>
              {post.visibility === 'public' ? <Globe size={10} /> : <Users size={10} />}
              {post.channel_slug && (
                <>
                  <span>·</span>
                  <Link
                    href={`/c/${post.channel_slug}`}
                    className="flex items-center gap-0.5 text-accent hover:underline"
                  >
                    <Hash size={9} />
                    <span className="normal-case tracking-normal">{post.channel_slug}</span>
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        {canDelete && (
          <button
            onClick={remove}
            disabled={deleting}
            className="p-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors shrink-0"
            title={isMine ? 'Delete post' : 'Delete post (moderator)'}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {post.body && (
        <div className="space-y-2">
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line break-words">
            {shownBody}
          </p>
          {isLong && (
            <button
              onClick={() => setExpandedBody((v) => !v)}
              className="flex items-center space-x-1 text-accent text-xs font-bold uppercase tracking-widest hover:underline"
            >
              {expandedBody ? (
                <>
                  <ChevronUp size={14} />
                  <span>Show Less</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>Read More</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {post.media_id && (
        <Link
          href={mediaHref}
          className="flex items-center gap-3 p-3 rounded-2xl bg-black/30 border border-white/10 hover:border-accent/40 transition-colors group/media"
        >
          <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-card shrink-0">
            <Image
              src={getImageUrl(post.poster_path, 'w185')}
              alt={post.media_title ?? ''}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-accent uppercase tracking-widest">
              {post.media_type === 'tv' ? <TvIcon size={11} /> : <Film size={11} />}
              <span>{post.media_type === 'tv' ? 'TV Series' : 'Movie'}</span>
            </p>
            <p className="text-sm font-bold text-white truncate group-hover/media:text-accent transition-colors">
              {post.media_title}
            </p>
            {post.season != null && post.episode != null && (
              <p className="text-xs text-muted">
                S{post.season} · E{post.episode}
              </p>
            )}
          </div>
        </Link>
      )}

      {post.image_url && (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
          <Image
            src={post.image_url}
            alt=""
            width={1200}
            height={800}
            sizes="(max-width: 768px) 100vw, 640px"
            className="w-full h-auto max-h-[32rem] object-contain"
          />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <PostReactions
          postId={post.id}
          counts={post.reaction_counts}
          myReaction={post.my_reaction}
          onChanged={({ myReaction, counts }) =>
            onChanged({ ...post, my_reaction: myReaction, reaction_counts: counts })
          }
        />

        <button
          onClick={() => setShowComments((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
            showComments
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
          }`}
        >
          <MessageCircle size={14} />
          <span>
            {post.comment_count > 0 ? post.comment_count : ''} {post.comment_count === 1 ? 'Comment' : 'Comments'}
          </span>
        </button>
      </div>

      {showComments && (
        <PostComments
          postId={post.id}
          postOwnerId={post.user_id}
          onCountChange={(delta) =>
            onChanged({ ...post, comment_count: Math.max(0, post.comment_count + delta) })
          }
        />
      )}
    </div>
  );
};

export default PostCard;
