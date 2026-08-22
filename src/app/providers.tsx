"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

/**
 * Client-side PostHog init. Graceful no-op when NEXT_PUBLIC_POSTHOG_KEY is
 * unset — the app still ships on $0 with only the Supabase keys (CLAUDE.md
 * env-vars). Pageviews, pageleaves, and SPA history changes are captured
 * automatically via `defaults`, so no manual PostHogPageView is needed.
 *
 * Requests route through the /ingest reverse proxy (next.config.mjs rewrites)
 * to survive ad blockers.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
