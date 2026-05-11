"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import releaseNotes from "@/data/release-notes.json";
import type { ReleaseNote } from "@/types";
import WhatsNewPopup from "./WhatsNewPopup";
import WhatsNewModal from "./WhatsNewModal";

const POPUP_DELAY_MS = 1500;

export default function WhatsNewLauncher() {
  const { data: session, update } = useSession();
  const [popupOpen, setPopupOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Locally suppress further showings once dismissed in this session, even before
  // the session.update() round-trip resolves.
  const [suppressedIds, setSuppressedIds] = useState<string[]>([]);

  const notes = releaseNotes as ReleaseNote[];

  const target = useMemo(() => {
    if (!session?.user?.id) return null;
    const seen = new Set([
      ...(session.user.seenWhatsNewIds ?? []),
      ...suppressedIds,
    ]);
    return notes.find((n) => n.whatsNew && !seen.has(n.whatsNew.id)) ?? null;
  }, [session, notes, suppressedIds]);

  // Trigger the popup with a 1.5s delay after mount / when a new target appears
  useEffect(() => {
    if (!target) {
      setPopupOpen(false);
      return;
    }
    if (modalOpen || popupOpen) return;
    const t = setTimeout(() => setPopupOpen(true), POPUP_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.whatsNew?.id]);

  async function markSeen(id: string) {
    setSuppressedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPopupOpen(false);
    setModalOpen(false);

    // Persist server-side, then push into the in-memory token so this dismissal
    // survives page reloads within the same session.
    try {
      await fetch("/api/users/me/seen-whats-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const next = Array.from(
        new Set([...(session?.user?.seenWhatsNewIds ?? []), id])
      );
      await update({ seenWhatsNewIds: next });
    } catch {
      // swallow — popup stays suppressed locally; will retry on next sign-in
    }
  }

  if (!target?.whatsNew) return null;

  return (
    <>
      <WhatsNewPopup
        open={popupOpen}
        releaseNote={target}
        onClose={() => markSeen(target.whatsNew!.id)}
        onShowMore={() => {
          setPopupOpen(false);
          setModalOpen(true);
        }}
      />
      <WhatsNewModal
        open={modalOpen}
        releaseNote={target}
        onClose={() => markSeen(target.whatsNew!.id)}
      />
    </>
  );
}
