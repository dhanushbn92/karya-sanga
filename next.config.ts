import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers don't run Vercel's image-optimization service.
  // Letting `next/image` pass URLs through unchanged keeps things simple
  // and is fine for our use case (one PNG hero + user-uploaded wall images
  // already served via Supabase signed URLs).
  images: {
    unoptimized: true,
  },
  // Keep these out of the bundled server trace. Packages with a "workerd"
  // export condition are copied ONCE by the OpenNext Cloudflare adapter
  // instead of being inlined into handler.mjs by esbuild.
  //   - pg / pg-cloudflare: the Postgres driver + its cloudflare:sockets TCP
  //     impl; otherwise esbuild fails with "Could not resolve pg-cloudflare".
  //   - @prisma/client: its query-compiler WASM (~2.4 MB) was getting inlined
  //     into handler.mjs multiple times (the trace had several resolved
  //     copies), pushing the worker to ~12.6 MB. Externalizing it makes
  //     OpenNext copy the WASM once, keeping the worker under the size limit.
  serverExternalPackages: ["pg", "pg-cloudflare", "@prisma/client"],
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
