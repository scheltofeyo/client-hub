"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { WEEK_CARD_TYPES } from "@/lib/utils";
import type { WeekCalendarItem } from "@/lib/utils";

interface Props {
  items: WeekCalendarItem[];
}

export default function OtherEventsColumn({ items }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="typo-card-title" style={{ color: "var(--text-primary)" }}>
          Events & Tasks
        </h3>
        {items.length > 0 && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-2">
          <CalendarDays size={24} style={{ color: "var(--text-muted-light)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Nothing scheduled
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const config = WEEK_CARD_TYPES[item.type];
            return (
              <Link
                key={item.id}
                href={item.linkHref}
                className="block rounded-lg p-3 transition-colors hover:bg-[var(--bg-hover)] border"
                style={{
                  borderColor: "var(--border)",
                  borderLeftWidth: 3,
                  borderLeftColor: config.color,
                  background: "var(--bg-surface)",
                }}
              >
                <span
                  className="typo-tag"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
                <p
                  className="text-sm font-medium truncate mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.title}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {item.meta ?? item.clientName}
                  </span>
                  {item.leads.length > 0 && (
                    <div className="flex items-center -space-x-1.5 shrink-0 ml-2">
                      {item.leads.slice(0, 2).map((lead) => (
                        <div
                          key={lead.userId}
                          style={{ boxShadow: "0 0 0 2px var(--bg-surface)" }}
                          className="rounded-full"
                        >
                          <UserAvatar name={lead.name} image={lead.image} size={16} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
