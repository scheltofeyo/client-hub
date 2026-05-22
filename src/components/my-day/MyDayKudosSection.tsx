"use client";

import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { timeAgoLabel, daysAgo } from "@/lib/utils";
import type { Kudos } from "@/types";

interface Props {
  kudos: Kudos[];
}

export default function MyDayKudosSection({ kudos }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
            Schouderklopjes
          </h2>
          {kudos.length > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--primary-light)", color: "var(--primary)" }}
            >
              {kudos.length}
            </span>
          )}
        </div>
        <Link
          href="/tools/kudos"
          className="text-xs font-medium"
          style={{ color: "var(--primary)" }}
        >
          Alles bekijken →
        </Link>
      </div>

      {kudos.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nog geen recente schouderklopjes — wie weet vandaag!
        </p>
      ) : (
        <div className="space-y-2">
          {kudos.map((k) => (
            <Link
              key={k.id}
              href="/tools/kudos"
              className="block rounded-card border p-3 hover-row transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div className="flex items-start gap-3">
                <UserAvatar name={k.fromUserName} image={k.fromUserImage} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {k.fromUserName}
                    </p>
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                      {k.createdAt ? timeAgoLabel(daysAgo(k.createdAt)) : ""}
                    </span>
                  </div>
                  {k.categorySnapshot && (
                    <span
                      className="typo-tag inline-block px-2 py-0.5 rounded-full mt-1"
                      style={{
                        background: k.categorySnapshot.color + "22",
                        color: k.categorySnapshot.color,
                      }}
                    >
                      {k.categorySnapshot.label}
                    </span>
                  )}
                  <p
                    className="text-sm mt-1 line-clamp-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {k.message}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
