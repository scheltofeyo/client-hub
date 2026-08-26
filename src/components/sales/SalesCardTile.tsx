"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { clientColor } from "@/lib/styles";
import { formatEuro } from "@/components/ui/editor-panel/money";
import { fmtDate } from "@/lib/utils";
import type { SalesCard } from "@/types";

function initials(company: string): string {
  const parts = company.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** The visual card. Split out so DragOverlay can render it without dnd wiring. */
export function SalesCardBody({ card, dragging }: { card: SalesCard; dragging?: boolean }) {
  const color = clientColor({ company: card.company, primaryColor: card.clientPrimaryColor });
  const overdue =
    !!card.expectedCloseDate &&
    !card.outcome &&
    card.expectedCloseDate < new Date().toISOString().split("T")[0];

  return (
    <div
      className="rounded-button border p-3"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-surface)",
        boxShadow: dragging ? "var(--shadow-dropdown)" : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: color.bg, color: color.fg }}
        >
          {initials(card.company)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="typo-card-title truncate" style={{ color: "var(--text-primary)" }}>
            {card.company}
          </p>
          {card.contact && (
            <p className="typo-caption truncate">
              {card.contact.firstName} {card.contact.lastName}
            </p>
          )}
        </div>
        <GripVertical
          size={14}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
          style={{ color: "var(--text-muted)" }}
        />
      </div>

      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {card.labels.map((label) => (
            <span
              key={label}
              className="rounded-badge px-2 py-0.5 typo-tag"
              style={{ background: "var(--bg-neutral)", color: "var(--text-muted)" }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {(card.dealValue != null || card.expectedCloseDate || card.owners.length > 0) && (
        <div className="flex items-center gap-2 mt-2.5">
          {card.dealValue != null && (
            <span className="typo-body-sm tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatEuro(card.dealValue)}
            </span>
          )}
          {card.expectedCloseDate && (
            <span
              className="typo-caption inline-flex items-center gap-1 tabular-nums"
              style={overdue ? { color: "var(--danger)" } : undefined}
            >
              <CalendarClock size={11} />
              {fmtDate(card.expectedCloseDate)}
            </span>
          )}
          {card.owners.length > 0 && (
            <span className="ml-auto flex items-center">
              {card.owners.slice(0, 3).map((o, i) => (
                <span
                  key={o.userId}
                  style={{ marginLeft: i === 0 ? 0 : -5, outline: "2px solid var(--bg-surface)", borderRadius: 9999 }}
                >
                  <UserAvatar name={o.name} image={o.image} size={20} />
                </span>
              ))}
              {card.owners.length > 3 && (
                <span className="typo-caption ml-1 tabular-nums">+{card.owners.length - 3}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SalesCardTile({
  card,
  onOpen,
  draggable,
}: {
  card: SalesCard;
  onOpen: (card: SalesCard) => void;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: draggable ? "grab" : "pointer",
      }}
      className="group active:cursor-grabbing"
      onClick={() => onOpen(card)}
      {...attributes}
      {...listeners}
    >
      <SalesCardBody card={card} />
    </div>
  );
}
