import React from 'react';
import Link from 'next/link';

/**
 * Lightweight inline formatting for posts, comments and messages.
 *
 * Deliberately NOT a markdown library and deliberately not HTML: this
 * returns React elements, so user text can never become markup. Nothing
 * here touches dangerouslySetInnerHTML, which is the only way this kind
 * of feature turns into stored XSS.
 *
 * Supported: **bold**, *italic*, `code`, ~~strike~~, and bare URLs.
 * Newlines are preserved by the caller's `whitespace-pre-line`.
 */

// One pass, alternation ordered so `code` wins before emphasis — otherwise
// `**` inside a code span would format.
const TOKEN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|(?:https?:\/\/|www\.)[^\s<>]+)/g;

// Trailing punctuation is almost always sentence punctuation, not part of
// the URL. Closing brackets are kept only when balanced by an opener.
function splitTrailingPunctuation(raw: string): [string, string] {
  let url = raw;
  let tail = '';
  while (url.length > 0) {
    const last = url[url.length - 1];
    if ('.,!?;:'.includes(last)) {
      tail = last + tail;
      url = url.slice(0, -1);
    } else if (last === ')' && !url.includes('(')) {
      tail = last + tail;
      url = url.slice(0, -1);
    } else {
      break;
    }
  }
  return [url, tail];
}

/** null for anything we won't turn into a link. */
function safeHref(raw: string): string | null {
  const candidate = raw.startsWith('www.') ? `https://${raw}` : raw;
  try {
    const url = new URL(candidate);
    // Allowlist, not a blocklist: javascript:, data: and friends never pass.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function siteOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

const linkClass = 'text-accent underline underline-offset-2 hover:no-underline break-words';

export function renderRichText(text: string): React.ReactNode[] {
  if (!text) return [];

  const origin = siteOrigin();
  const parts = text.split(TOKEN);

  return parts.map((part, i) => {
    if (!part) return null;

    // Odd indices are the captured tokens; even ones are plain text.
    if (i % 2 === 0) return <React.Fragment key={i}>{part}</React.Fragment>;

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-black/40 border border-white/10 text-[0.9em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('~~') && part.endsWith('~~')) {
      return (
        <span key={i} className="line-through opacity-70">
          {part.slice(2, -2)}
        </span>
      );
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Otherwise it matched the URL branch.
    const [rawUrl, tail] = splitTrailingPunctuation(part);
    const href = safeHref(rawUrl);
    if (!href) return <React.Fragment key={i}>{part}</React.Fragment>;

    // Links back into the app stay client-side so they don't reload the SPA.
    let internalPath: string | null = null;
    if (origin) {
      try {
        const parsed = new URL(href);
        if (parsed.origin === origin) internalPath = parsed.pathname + parsed.search;
      } catch {
        internalPath = null;
      }
    }

    return (
      <React.Fragment key={i}>
        {internalPath ? (
          <Link href={internalPath} className={linkClass}>
            {rawUrl}
          </Link>
        ) : (
          <a
            href={href}
            target="_blank"
            // noreferrer matters as much as noopener: without it the
            // destination learns which conversation the link came from.
            rel="noopener noreferrer nofollow"
            className={linkClass}
          >
            {rawUrl}
          </a>
        )}
        {tail}
      </React.Fragment>
    );
  });
}

/** Drop-in for a <p> that used to render `{body}` directly. */
export const RichText = ({ text }: { text: string }) => <>{renderRichText(text)}</>;

export default RichText;
