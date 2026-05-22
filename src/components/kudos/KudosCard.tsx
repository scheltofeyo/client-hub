"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { timeAgoLabel, daysAgo } from "@/lib/utils";
import type { Kudos, KudosReactionEmoji } from "@/types";
import KudosReactionBar from "./KudosReactionBar";

export default function KudosCard({
  kudos,
  currentUserId,
  onToggleReaction,
  onDelete,
}: {
  kudos: Kudos;
  currentUserId: string;
  onToggleReaction: (id: string, emoji: KudosReactionEmoji) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwn = kudos.fromUserId === currentUserId;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="rounded-card border p-4"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={kudos.fromUserName} image={kudos.fromUserImage} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <span className="font-semibold">{kudos.fromUserName}</span>
                <span style={{ color: "var(--text-muted)" }}> gaf een schouderklopje aan </span>
                {kudos.toUsers.map((u, i) => (
                  <span key={u.userId}>
                    <span className="font-semibold">{u.name}</span>
                    {i < kudos.toUsers.length - 1 && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {i === kudos.toUsers.length - 2 ? " en " : ", "}
                      </span>
                    )}
                  </span>
                ))}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {kudos.createdAt ? timeAgoLabel(daysAgo(kudos.createdAt)) : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {kudos.categorySnapshot && (
                <span
                  className="typo-tag px-2 py-0.5 rounded-full"
                  style={{
                    background: kudos.categorySnapshot.color + "22",
                    color: kudos.categorySnapshot.color,
                  }}
                >
                  {kudos.categorySnapshot.label}
                </span>
              )}
              {isOwn && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="btn-icon p-1 rounded-md"
                    aria-label="Meer opties"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-1 rounded-md border shadow-dropdown z-10 min-w-[140px]"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                    >
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(kudos.id);
                        }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-hover"
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={14} />
                        Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p
            className="mt-3 text-sm whitespace-pre-wrap"
            style={{ color: "var(--text-primary)" }}
          >
            {kudos.message}
          </p>

          <div className="mt-3">
            <KudosReactionBar
              reactions={kudos.reactions}
              currentUserId={currentUserId}
              onToggle={(emoji) => onToggleReaction(kudos.id, emoji)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
