/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-leaflet ships ESM; transpile it so it plays nice with Next's compiler.
  transpilePackages: ["react-leaflet", "@react-leaflet/core"],
  // Proxy PostHog through /ingest so analytics survive ad blockers (US cloud).
  // For EU, swap us-assets/us.i → eu-assets/eu.i.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog's ingestion endpoints must not be redirected by trailing-slash handling.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
