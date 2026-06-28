"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Postgres CDC on WallPost / Reaction / Comment.
 * Any insert, update, or delete triggers `router.refresh()` so the server
 * component re-runs and the page picks up the new state.
 *
 * Why router.refresh instead of patching state in place: the page is a
 * server component that joins multiple tables (signed URLs, counts,
 * "mine" flags). Re-rendering from the server is simpler and correct;
 * we'd only diverge if the cohort gets so big that the refresh storm
 * becomes a problem — at which point switch to event-shaped state.
 *
 * Debounced: bursts of events within 500 ms collapse to one refresh.
 */
export function WallRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
      }, 500);
    };

    const channel = supabase
      .channel("wall-cdc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "WallPost" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Reaction" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Comment" },
        refresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
