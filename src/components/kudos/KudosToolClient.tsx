"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Kudos, KudosCategory, KudosReactionEmoji } from "@/types";
import KudosFeed from "./KudosFeed";
import KudosDashboard from "./KudosDashboard";
import KudosForm from "./KudosForm";

interface AssignableUser { id: string; name: string; image: string | null }

export default function KudosToolClient({
  activeTab,
  currentUserId,
}: {
  activeTab: "feed" | "dashboard";
  currentUserId: string;
}) {
  const { openPanel, closePanel } = useRightPanel();
  const [kudos, setKudos] = useState<Kudos[]>([]);
  const [categories, setCategories] = useState<KudosCategory[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    const res = await fetch("/api/kudos?limit=50");
    if (res.ok) setKudos(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [feedRes, catsRes, usersRes] = await Promise.all([
          fetch("/api/kudos?limit=50"),
          fetch("/api/kudos-categories"),
          fetch("/api/users/assignable"),
        ]);
        if (cancelled) return;
        if (feedRes.ok) setKudos(await feedRes.json());
        if (catsRes.ok) setCategories(await catsRes.json());
        if (usersRes.ok) setUsers(await usersRes.json());
        // Mark seen — fire and forget
        fetch("/api/kudos/mark-seen", { method: "POST" }).catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = useCallback(
    async (payload: { toUserIds: string[]; message: string; categoryId?: string }) => {
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kon kudo niet versturen");
      }
      await loadFeed();
      closePanel();
    },
    [loadFeed, closePanel]
  );

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/kudos/${id}`, { method: "DELETE" });
    if (res.ok) setKudos((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const handleToggleReaction = useCallback(
    async (id: string, emoji: KudosReactionEmoji) => {
      // Optimistic
      setKudos((prev) =>
        prev.map((k) => {
          if (k.id !== id) return k;
          const existing = k.reactions.find((r) => r.userId === currentUserId && r.emoji === emoji);
          if (existing) {
            return { ...k, reactions: k.reactions.filter((r) => !(r.userId === currentUserId && r.emoji === emoji)) };
          }
          return {
            ...k,
            reactions: [...k.reactions, { userId: currentUserId, emoji, createdAt: new Date().toISOString() }],
          };
        })
      );
      const res = await fetch(`/api/kudos/${id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setKudos((prev) =>
          prev.map((k) => (k.id === id ? { ...k, reactions: data.reactions } : k))
        );
      } else {
        // Revert on failure
        await loadFeed();
      }
    },
    [currentUserId, loadFeed]
  );

  const openGiveForm = useCallback(() => {
    openPanel(
      "Geef een schouderklopje",
      <KudosForm
        users={users.filter((u) => u.id !== currentUserId)}
        categories={categories}
        onSubmit={handleCreate}
      />
    );
  }, [openPanel, users, categories, currentUserId, handleCreate]);

  return (
    <div className="px-7 pb-7 pt-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {activeTab === "feed"
            ? "Geef en ontvang waardering binnen het team."
            : "Een luchtige blik op wie deze week en maand veel kudos kreeg en gaf."}
        </p>
        <button onClick={openGiveForm} className="btn-primary inline-flex items-center gap-1.5">
          <Plus size={16} />
          Geef een schouderklopje
        </button>
      </div>

      {activeTab === "feed" ? (
        <KudosFeed
          kudos={kudos}
          loading={loading}
          currentUserId={currentUserId}
          onToggleReaction={handleToggleReaction}
          onDelete={handleDelete}
        />
      ) : (
        <KudosDashboard />
      )}
    </div>
  );
}
