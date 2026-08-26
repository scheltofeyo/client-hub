"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Archive, Plus, Settings2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useRightPanel } from "@/components/layout/RightPanel";
import SalesColumn from "./SalesColumn";
import { SalesCardBody } from "./SalesCardTile";
import AddProspectPicker from "./AddProspectPicker";
import SalesCardEditor from "./SalesCardEditor";
import BoardSettingsEditor from "./BoardSettingsEditor";
import type { ProspectOption, SalesBoard, SalesCard } from "@/types";

const COLUMN_PREFIX = "col:";

/**
 * Recompute the whole card list after `activeId` is dropped on `overId`.
 * Handles both reordering inside a column and moving across columns; `overId`
 * is either another card's id or a column's droppable id.
 */
function reposition(cards: SalesCard[], activeId: string, overId: string): SalesCard[] {
  const active = cards.find((c) => c.id === activeId);
  if (!active) return cards;

  const toColumn = overId.startsWith(COLUMN_PREFIX)
    ? overId.slice(COLUMN_PREFIX.length)
    : cards.find((c) => c.id === overId)?.columnId;
  if (!toColumn) return cards;

  // Archived cards keep a columnId but never render, so they must stay out of
  // the index math — otherwise arrayMove shuffles around an invisible card.
  const column = cards
    .filter((c) => c.columnId === toColumn && !c.outcome)
    .sort((a, b) => a.order - b.order);
  const oldIndex = column.findIndex((c) => c.id === activeId);

  let next: SalesCard[];
  if (oldIndex !== -1) {
    const overIndex = overId.startsWith(COLUMN_PREFIX)
      ? column.length - 1
      : column.findIndex((c) => c.id === overId);
    if (overIndex === -1 || overIndex === oldIndex) return cards;
    next = arrayMove(column, oldIndex, overIndex);
  } else {
    const overIndex = overId.startsWith(COLUMN_PREFIX)
      ? column.length
      : column.findIndex((c) => c.id === overId);
    const at = overIndex === -1 ? column.length : overIndex;
    next = [...column.slice(0, at), { ...active, columnId: toColumn }, ...column.slice(at)];
  }

  const orderMap = new Map(next.map((c, i) => [c.id, i]));
  return cards.map((c) => {
    if (c.id === activeId) return { ...c, columnId: toColumn, order: orderMap.get(c.id) ?? 0 };
    if (c.columnId === toColumn && !c.outcome) return { ...c, order: orderMap.get(c.id) ?? c.order };
    return c;
  });
}

export default function SalesBoardView({
  board: initialBoard,
  cards: initialCards,
  prospects,
  canManageBoards,
  canManageCards,
  canConvert,
}: {
  board: SalesBoard;
  cards: SalesCard[];
  prospects: ProspectOption[];
  canManageBoards: boolean;
  canManageCards: boolean;
  canConvert: boolean;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [cards, setCards] = useState(initialCards);
  const [showArchived, setShowArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();

  // Snapshot to roll back to if the move request fails.
  const beforeDragRef = useRef<SalesCard[] | null>(null);
  // A drag ending on the card also fires a click; this suppresses that one.
  const draggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openCards = useMemo(() => cards.filter((c) => !c.outcome), [cards]);
  const archivedCards = useMemo(() => cards.filter((c) => c.outcome), [cards]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, SalesCard[]>();
    for (const column of board.columns) map.set(column.id, []);
    for (const card of openCards) {
      const list = map.get(card.columnId);
      if (list) list.push(card);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [board.columns, openCards]);

  const cardCountByColumn = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [columnId, list] of cardsByColumn) counts[columnId] = list.length;
    return counts;
  }, [cardsByColumn]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : undefined;

  const contactsFor = useCallback(
    (card: SalesCard) => {
      const prospect = prospects.find((p) => p.id === card.clientId);
      if (prospect?.contacts?.length) return prospect.contacts;
      return card.contact ? [card.contact] : [];
    },
    [prospects]
  );

  // ── Panels ───────────────────────────────────────────────────────
  const openCardEditor = useCallback(
    (card: SalesCard) => {
      if (draggingRef.current) return;
      openPanel(
        card.company,
        <SalesCardEditor
          card={card}
          contacts={contactsFor(card)}
          canManageCards={canManageCards}
          canConvert={canConvert}
          onUpdated={(updated) =>
            setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
          }
          onRemoved={(cardId) => {
            setCards((prev) => prev.filter((c) => c.id !== cardId));
            router.refresh();
          }}
          onClosed={(cardId, outcome, promoted) => {
            setCards((prev) =>
              prev.map((c) => (c.id === cardId ? { ...c, outcome, outcomeAt: new Date().toISOString() } : c))
            );
            window.dispatchEvent(new Event("sales-boards-updated"));
            // A promotion changed the client's status, so the prospect list is stale.
            if (promoted) router.refresh();
          }}
          onClose={closePanel}
        />,
        { padded: false }
      );
    },
    [openPanel, closePanel, contactsFor, canManageCards, canConvert, router]
  );

  function openAddProspect(columnId: string) {
    openPanel(
      "Prospect toevoegen",
      <AddProspectPicker
        boardId={board.id}
        columnId={columnId}
        prospects={prospects}
        existingClientIds={openCards.map((c) => c.clientId)}
        onAdded={(card) => {
          setCards((prev) => [...prev, card]);
          window.dispatchEvent(new Event("sales-boards-updated"));
        }}
        onClose={closePanel}
      />
    );
  }

  function openBoardSettings() {
    openPanel(
      "Bordinstellingen",
      <BoardSettingsEditor
        board={board}
        cardCountByColumn={cardCountByColumn}
        onUpdated={setBoard}
        onClose={closePanel}
      />,
      { padded: false }
    );
  }

  // ── Drag and drop ────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    draggingRef.current = true;
    beforeDragRef.current = cards;
    setActiveId(active.id as string);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeCardId = active.id as string;
    const overId = over.id as string;

    const from = cards.find((c) => c.id === activeCardId)?.columnId;
    const to = overId.startsWith(COLUMN_PREFIX)
      ? overId.slice(COLUMN_PREFIX.length)
      : cards.find((c) => c.id === overId)?.columnId;
    // Same-column shuffling is handled visually by SortableContext and
    // committed on drop; only column crossings need a state change here.
    if (!from || !to || from === to) return;

    setCards((prev) => reposition(prev, activeCardId, overId));
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    // Release the click guard after the synthetic click has passed.
    setTimeout(() => {
      draggingRef.current = false;
    }, 0);

    const snapshot = beforeDragRef.current;
    beforeDragRef.current = null;
    if (!over) {
      if (snapshot) setCards(snapshot);
      return;
    }

    const cardId = active.id as string;
    const next = reposition(cards, cardId, over.id as string);
    setCards(next);

    const moved = next.find((c) => c.id === cardId);
    const original = snapshot?.find((c) => c.id === cardId);
    if (!moved) return;

    const sameColumn = original?.columnId === moved.columnId;
    const sameOrder = original?.order === moved.order;
    if (sameColumn && sameOrder) return;

    const orderedIds = next
      .filter((c) => c.columnId === moved.columnId && !c.outcome)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);

    const res = await fetch(`/api/sales/boards/${board.id}/cards/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, toColumnId: moved.columnId, orderedIds }),
    });
    if (!res.ok && snapshot) setCards(snapshot);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Sales", href: "/sales" }, { label: board.name }]}
        title={board.name}
        actions={
          <>
            {archivedCards.length > 0 && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="btn-border border"
                aria-pressed={showArchived}
              >
                <Archive size={14} className="inline mr-1.5 -mt-px" />
                Archief ({archivedCards.length})
              </button>
            )}
            {canManageBoards && (
              <button onClick={openBoardSettings} className="btn-border border">
                <Settings2 size={14} className="inline mr-1.5 -mt-px" />
                Instellingen
              </button>
            )}
            {canManageCards && board.columns.length > 0 && (
              <button onClick={() => openAddProspect(board.columns[0].id)} className="btn-primary">
                <Plus size={14} className="inline mr-1.5 -mt-px" />
                Prospect
              </button>
            )}
          </>
        }
      />

      <div
        className="flex-1 overflow-hidden flex flex-col px-7 py-6"
        style={{ background: "var(--bg-tinted)" }}
      >
        {/* minmax(0, 1fr) bounds the rail to the available width so the
            horizontal scroll happens inside it instead of stretching the page. */}
        <div className="flex-1 min-h-0" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-2 items-start max-h-full">
              {board.columns.map((column) => (
                <SalesColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn.get(column.id) ?? []}
                  canManageCards={canManageCards}
                  onOpenCard={openCardEditor}
                  onAddProspect={openAddProspect}
                />
              ))}
            </div>

            <DragOverlay>
              {activeCard ? (
                <div className="w-[284px] rotate-2">
                  <SalesCardBody card={activeCard} dragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {showArchived && archivedCards.length > 0 && (
          <div className="shrink-0 mt-5">
            <h2 className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
              Archief
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {archivedCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => openCardEditor(card)}
                  className="w-[260px] shrink-0 cursor-pointer"
                >
                  <div style={{ opacity: 0.65 }}>
                    <SalesCardBody card={card} />
                  </div>
                  <p className="typo-caption mt-1 pl-1">
                    {card.outcome === "won" ? "Gewonnen" : "Verloren"}
                    {card.outcomeByName ? ` · ${card.outcomeByName}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
