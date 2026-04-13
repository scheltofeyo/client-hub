"use client";

import { SessionProvider } from "next-auth/react";
import SessionGate from "./SessionGate";

export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGate>{children}</SessionGate>
    </SessionProvider>
  );
}
