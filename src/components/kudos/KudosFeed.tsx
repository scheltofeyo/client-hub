"use client";

import type { Kudos, KudosReactionEmoji } from "@/types";
import KudosCard from "./KudosCard";

export default function KudosFeed({
  kudos,
  loading,
  currentUserId,
  onToggleReaction,
  onDelete,
}: {
  kudos: Kudos[];
  loading: boolean;
  currentUserId: string;
  onToggleReaction: (id: string, emoji: KudosReactionEmoji) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Schouderklopjes laden…
      </p>
    );
  }

  if (kudos.length === 0) {
    return (
      <div
        className="rounded-card border p-8 text-center"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <p className="typo-card-title mb-1" style={{ color: "var(--text-primary)" }}>
          Nog geen schouderklopjes
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Wees de eerste — geef een collega een complimentje.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {kudos.map((k) => (
        <KudosCard
          key={k.id}
          kudos={k}
          currentUserId={currentUserId}
          onToggleReaction={onToggleReaction}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
