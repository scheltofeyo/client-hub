"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import SalesCardTile from "./SalesCardTile";
import { formatEuro } from "@/components/ui/editor-panel/money";
import type { SalesBoardColumn, SalesCard } from "@/types";

/** Droppable id for the column body, so an empty column is still a drop target. */
export const columnDroppableId = (columnId: string) => `col:${columnId}`;

export default function SalesColumn({
  column,
  cards,
  canManageCards,
  onOpenCard,
  onAddProspect,
}: {
  column: SalesBoardColumn;
  cards: SalesCard[];
  canManageCards: boolean;
  onOpenCard: (card: SalesCard) => void;
  onAddProspect: (columnId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(column.id) });
  const total = cards.reduce((sum, c) => sum + (c.dealValue ?? 0), 0);

  return (
    <div
      className="w-[300px] shrink-0 flex flex-col rounded-card border max-h-full"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {/* Column header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: column.color }}
            aria-hidden
          />
          <span className="typo-card-title truncate" style={{ color: "var(--text-primary)" }}>
            {column.title}
          </span>
          <span
            className="ml-auto rounded-badge px-2 py-0.5 typo-caption tabular-nums shrink-0"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {cards.length}
          </span>
        </div>
        {total > 0 && (
          <p className="typo-caption tabular-nums mt-1 pl-4">{formatEuro(total)}</p>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-[80px] overflow-y-auto px-2 pb-2 space-y-2 rounded-b-card transition-colors"
        style={{ background: isOver ? "var(--bg-hover)" : undefined }}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SalesCardTile
              key={card.id}
              card={card}
              onOpen={onOpenCard}
              draggable={canManageCards}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <p className="typo-caption text-center py-6">Geen prospects</p>
        )}

        {canManageCards && (
          <button
            onClick={() => onAddProspect(column.id)}
            className="btn-tertiary w-full justify-center"
          >
            <Plus size={13} className="inline mr-1 -mt-px" />
            Prospect
          </button>
        )}
      </div>
    </div>
  );
}
