"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

export default function FolderPendingBanner({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<"pending" | "ready" | "dismissed">("pending");
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/folder-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.folderStatus === "ready") {
          clearInterval(intervalRef.current!);
          setStatus("ready");
        }
      } catch {
        // network error — keep polling
      }
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [clientId, router]);

  if (status === "dismissed") return null;

  if (status === "ready") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 text-sm"
        style={{
          background: "var(--primary-light, #ede9fe)",
          borderBottom: "1px solid var(--border)",
          color: "var(--primary)",
        }}
      >
        <CheckCircle size={14} className="shrink-0" />
        <span className="flex-1">Google Drive folders and sheets have been created.</span>
        <button
          onClick={() => { setStatus("dismissed"); router.refresh(); }}
          className="px-2.5 py-1 rounded-md text-xs font-medium btn-primary"
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background: "var(--primary-light, #ede9fe)",
        borderBottom: "1px solid var(--border)",
        color: "var(--primary)",
      }}
    >
      <Loader2 size={14} className="animate-spin shrink-0" />
      <span>Creating Google Drive folder and sheets — this may take a moment...</span>
    </div>
  );
}
