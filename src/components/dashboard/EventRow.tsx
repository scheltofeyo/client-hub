"use client";

import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { WEEK_CARD_TYPES } from "@/lib/utils";
import type { WeekCalendarItem } from "@/lib/utils";
import { resolveClientColor } from "@/lib/styles";

interface Props {
  item: WeekCalendarItem;
  /** Secondary line: client name, or the item's meta when present. */
  showMeta?: boolean;
}

/**
 * One event in a day-detail column. A borderless list row (it lives inside a
 * DayPanel surface) with the client identity carried by a color dot next to the
 * client name — no side-stripe border.
 */
export default function EventRow({ item, showMeta }: Props) {
  const config = WEEK_CARD_TYPES[item.type];
  const { bg: clientColor } = resolveClientColor(item.clientName, item.clientPrimaryColor);
  const secondary = showMeta ? item.meta ?? item.clientName : item.clientName;

  return (
    <Link
      href={item.linkHref}
      className="block rounded-button px-2.5 py-2 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="typo-tag rounded-badge px-1.5 py-0.5"
          style={{ background: config.bg, color: config.color }}
        >
          {config.label}
        </span>
        {item.leads.length > 0 && (
          <div className="flex shrink-0 items-center -space-x-1.5">
            {item.leads.slice(0, 2).map((lead) => (
              <div
                key={lead.userId}
                className="rounded-full"
                style={{ boxShadow: "0 0 0 2px var(--bg-surface)" }}
              >
                <UserAvatar name={lead.name} image={lead.image} size={22} />
              </div>
            ))}
          </div>
        )}
      </div>
      <p
        className="mt-1.5 truncate text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {item.title}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: clientColor }}
          aria-hidden
        />
        <span className="typo-caption truncate" style={{ color: "var(--text-muted)" }}>
          {secondary}
        </span>
      </div>
    </Link>
  );
}
