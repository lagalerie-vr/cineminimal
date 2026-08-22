import type { NextConfig } from "next";

// Next loads .env* before evaluating this file. If the URL is unset or
// malformed, omit the pattern rather than throwing: only Supabase-hosted
// images then fail, which is a far better failure mode than the whole
// build crashing.
//
// NOTE: remotePatterns is resolved at BUILD time. If you deploy and
// NEXT_PUBLIC_SUPABASE_URL isn't set in the build environment, this
// pattern silently vanishes and every uploaded image 400s in production
// while working perfectly in dev.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      // Scoped to the public object path with search: '' so the image
      // optimizer can't be pointed at the rest of the Supabase API.
      ...(supabaseHost
        ? [{
            protocol: 'https' as const,
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/**',
            search: '',
          }]
        : []),
    ]
  }
};

export default nextConfig;
