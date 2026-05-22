"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Lightweight client-side hook that returns the current user's unread kudos count.
 * Fetches once on mount and refetches when the route changes. Returns 0 when the
 * user lacks `tools.kudos.access` (no permission = no badge).
 */
export function useKudosUnreadCount(): number {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const canSee = (session?.user?.permissions ?? []).includes("tools.kudos.access");

  useEffect(() => {
    if (!canSee) return;
    let cancelled = false;
    fetch("/api/kudos/unread-count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((data) => {
        if (!cancelled) setCount(typeof data.count === "number" ? data.count : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canSee, pathname]);

  return canSee ? count : 0;
}
