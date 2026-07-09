"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export default function SessionProviderWrapper({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  // refetchInterval matches the 15-min statusCheckedAt window in src/auth.ts.
  // Each poll hits /api/auth/session — a route-handler context, the only place
  // a token bump can be persisted via Set-Cookie (RSC renders can't; see the
  // "RSC nuance" note in src/auth.ts). Without it, a long-lived tab past the
  // boundary re-pays the time-boxed DB re-check on every navigation's server
  // render. refetchOnWindowFocus (default true) covers tab-switch users too.
  return (
    <SessionProvider session={session} refetchInterval={15 * 60}>
      {children}
    </SessionProvider>
  );
}
