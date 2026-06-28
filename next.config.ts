import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers don't run Vercel's image-optimization service.
  // Letting `next/image` pass URLs through unchanged keeps things simple
  // and is fine for our use case (one PNG hero + user-uploaded wall images
  // already served via Supabase signed URLs).
  images: {
    unoptimized: true,
  },
};

// Open the OpenNext Cloudflare dev binding when running `next dev`. This is
// a no-op in production builds — the binding registration only happens when
// `process.env.OPEN_NEXT_DEV_BINDING` is set (the wrangler dev script does
// that for us).
if (process.env.NODE_ENV === "development") {
  // Dynamic import avoids loading the adapter in production bundles.
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev?.();
  }).catch(() => {
    // Adapter not available — that's fine for `next dev` without wrangler.
  });
}

export default nextConfig;
