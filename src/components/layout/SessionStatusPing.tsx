"use client";

import { useEffect } from "react";

/**
 * One non-blocking GET /api/auth/session shortly after hydration. The jwt
 * callback runs in a route-handler context there, so a statusCheckedAt bump
 * from the 15-min re-check is actually persisted via Set-Cookie — RSC renders
 * cannot persist it (see the "RSC nuance" note in src/auth.ts). Without this,
 * every server render past the boundary re-pays the time-boxed DB re-check
 * until the user's first API mutation happens to persist it. Delayed ~2s and
 * deferred to idle time to stay off the critical rendering path.
 */
export default function SessionStatusPing() {
  useEffect(() => {
    let idleHandle: number | undefined;
    const timer = setTimeout(() => {
      const fire = () => {
        fetch("/api/auth/session").catch(() => {});
      };
      if ("requestIdleCallback" in window) {
        idleHandle = requestIdleCallback(fire);
      } else {
        fire();
      }
    }, 2000);
    return () => {
      clearTimeout(timer);
      if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
    };
  }, []);

  return null;
}
