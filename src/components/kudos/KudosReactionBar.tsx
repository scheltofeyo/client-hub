"use client";

import { useMemo } from "react";
import type { KudosReaction, KudosReactionEmoji } from "@/types";

const EMOJIS: { key: KudosReactionEmoji; label: string }[] = [
  { key: "clap",  label: "👏" },
  { key: "raise", label: "🙌" },
  { key: "heart", label: "❤️" },
  { key: "fire",  label: "🔥" },
];

export default function KudosReactionBar({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: KudosReaction[];
  currentUserId: string;
  onToggle: (emoji: KudosReactionEmoji) => void;
}) {
  const counts = useMemo(() => {
    const map: Record<string, { count: number; mine: boolean }> = {};
    for (const e of EMOJIS) map[e.key] = { count: 0, mine: false };
    for (const r of reactions) {
      if (!map[r.emoji]) continue;
      map[r.emoji].count += 1;
      if (r.userId === currentUserId) map[r.emoji].mine = true;
    }
    return map;
  }, [reactions, currentUserId]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {EMOJIS.map(({ key, label }) => {
        const { count, mine } = counts[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors border"
            style={{
              background: mine ? "var(--primary-light)" : "var(--bg-elevated)",
              borderColor: mine ? "var(--primary)" : "var(--border)",
              color: mine ? "var(--primary)" : "var(--text-primary)",
            }}
          >
            <span aria-hidden="true">{label}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
