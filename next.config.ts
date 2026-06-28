import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers don't run Vercel's image-optimization service.
  // Letting `next/image` pass URLs through unchanged keeps things simple
  // and is fine for our use case (one PNG hero + user-uploaded wall images
  // already served via Supabase signed URLs).
  images: {
    unoptimized: true,
  },
  // Keep the Postgres driver out of the server bundle. `pg` loads
  // `pg-cloudflare` (a TCP socket impl using `cloudflare:sockets`) via a
  // "workerd" export condition. The OpenNext Cloudflare adapter only copies
  // such packages' full output (incl. dist/index.js) into the worker bundle
  // when they're listed here — otherwise esbuild fails with
  // "Could not resolve pg-cloudflare".
  serverExternalPackages: ["pg", "pg-cloudflare"],
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
