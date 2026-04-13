"use client";

import { useSession } from "next-auth/react";
import LoadingThinking from "@/components/ui/LoadingThinking";

export default function SessionGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div
        className="flex items-center justify-center h-screen w-screen"
        style={{ background: "var(--bg-app)" }}
      >
        <LoadingThinking />
      </div>
    );
  }

  return <>{children}</>;
}
