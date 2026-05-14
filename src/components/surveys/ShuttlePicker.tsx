"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, ArrowLeftRight, GripVertical } from "lucide-react";
import LiveDeltaChart from "./LiveDeltaChart";
import type { ArchetypeLite } from "./ArchetypePill";
import { cn } from "@/lib/cn";

export interface ShuttleQuestion {
  id: string;
  title: string;
  sectionId: string;
  sectionTitle: string;
}

export interface ShuttlePickerProps {
  questions: ShuttleQuestion[];
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  onChange: (next: { leftQuestionIds: string[]; rightQuestionIds: string[] }) => void;
  leftLabel: string;
  rightLabel: string;
  onLeftLabelChange?: (value: string) => void;
  onRightLabelChange?: (value: string) => void;
  archetypes: ArchetypeLite[];
  /** server-computed `questionId → archetypeId → percentage`. Empty / undefined → live delta hidden. */
  perQuestionPercentages?: Record<string, Record<string, number>>;
}

type ContainerKey = "left" | "unassigned" | "right";

interface ItemsState {
  left: string[];
  right: string[];
  unassigned: string[]; // unassigned in current section-grouped order (sorted by section then original order)
}

function computeUnassigned(
  questions: ShuttleQuestion[],
  leftIds: string[],
  rightIds: string[]
): string[] {
  const taken = new Set([...leftIds, ...rightIds]);
  return questions.filter((q) => !taken.has(q.id)).map((q) => q.id);
}

export default function ShuttlePicker({
  questions,
  leftQuestionIds,
  rightQuestionIds,
  onChange,
  leftLabel,
  rightLabel,
  onLeftLabelChange,
  onRightLabelChange,
  archetypes,
  perQuestionPercentages,
}: ShuttlePickerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Local optimistic state, synced from props.
  const [items, setItems] = useState<ItemsState>(() => ({
    left: leftQuestionIds,
    right: rightQuestionIds,
    unassigned: computeUnassigned(questions, leftQuestionIds, rightQuestionIds),
  }));

  // External prop changes (added/removed questions in the snapshot, or another consumer
  // updating the comparison) need to flow into local items. Sync via effect is the
  // pragmatic option here — the rule's preferred alternatives (controlled-only, key-reset)
  // would force us to give up the optimistic mid-drag state we need.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems({
      left: leftQuestionIds,
      right: rightQuestionIds,
      unassigned: computeUnassigned(questions, leftQuestionIds, rightQuestionIds),
    });
  }, [questions, leftQuestionIds, rightQuestionIds]);

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  function findContainer(id: string): ContainerKey | null {
    if (id === "left" || id === "unassigned" || id === "right") return id;
    if (items.left.includes(id)) return "left";
    if (items.right.includes(id)) return "right";
    if (items.unassigned.includes(id)) return "unassigned";
    return null;
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems((prev) => {
      const from = prev[activeContainer].filter((id) => id !== activeId);
      const toList = [...prev[overContainer]];
      const overIndex = toList.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : toList.length;
      toList.splice(insertAt, 0, activeId);
      return { ...prev, [activeContainer]: from, [overContainer]: toList };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return commit(items);

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) return commit(items);

    if (activeContainer === overContainer) {
      const list = items[activeContainer];
      const oldIndex = list.indexOf(activeId);
      const newIndex = list.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return commit(items);
      const reordered = arrayMove(list, oldIndex, newIndex);
      const next = { ...items, [activeContainer]: reordered };
      setItems(next);
      commit(next);
    } else {
      // cross-container: dragOver already moved; commit current state
      commit(items);
    }
  }

  function commit(state: ItemsState) {
    onChange({ leftQuestionIds: state.left, rightQuestionIds: state.right });
  }

  function moveAllInSection(sectionId: string, target: ContainerKey) {
    setItems((prev) => {
      const ids = questions.filter((q) => q.sectionId === sectionId).map((q) => q.id);
      const idSet = new Set(ids);
      const next: ItemsState = {
        left: prev.left.filter((id) => !idSet.has(id)),
        right: prev.right.filter((id) => !idSet.has(id)),
        unassigned: prev.unassigned.filter((id) => !idSet.has(id)),
      };
      next[target] = [...next[target], ...ids];
      commit(next);
      return next;
    });
  }

  function moveItem(itemId: string, target: ContainerKey) {
    setItems((prev) => {
      const from = (["left", "right", "unassigned"] as ContainerKey[]).find((k) =>
        prev[k].includes(itemId)
      );
      if (!from || from === target) return prev;
      const next: ItemsState = { ...prev };
      next[from] = prev[from].filter((id) => id !== itemId);
      next[target] = [...prev[target], itemId];
      commit(next);
      return next;
    });
  }

  // Group unassigned by section, preserving insertion order
  const unassignedGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { sectionId: string; sectionTitle: string; ids: string[] }>();
    for (const id of items.unassigned) {
      const q = questionMap.get(id);
      if (!q) continue;
      if (!map.has(q.sectionId)) {
        map.set(q.sectionId, { sectionId: q.sectionId, sectionTitle: q.sectionTitle, ids: [] });
        order.push(q.sectionId);
      }
      map.get(q.sectionId)!.ids.push(id);
    }
    return order.map((sid) => map.get(sid)!);
  }, [items.unassigned, questionMap]);

  return (
    <div className="space-y-4">
      <LiveDeltaChart
        archetypes={archetypes}
        leftQuestionIds={items.left}
        rightQuestionIds={items.right}
        perQuestionPercentages={perQuestionPercentages ?? {}}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Column
            containerKey="left"
            header={
              <ColumnHeader
                tone="primary"
                value={leftLabel}
                placeholder="Left label"
                onChange={onLeftLabelChange}
                count={items.left.length}
              />
            }
            itemIds={items.left}
            emptyHint="Drop questions here for the left set."
          >
            {items.left.map((id) => {
              const q = questionMap.get(id);
              if (!q) return null;
              return (
                <ShuttleCard
                  key={id}
                  id={id}
                  title={q.title || "(no title)"}
                  sectionTitle={q.sectionTitle}
                  onMove={(target) => moveItem(id, target)}
                  currentSide="left"
                />
              );
            })}
          </Column>

          <Column
            containerKey="unassigned"
            header={
              <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>Unassigned</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{items.unassigned.length} questions</p>
                </div>
              </div>
            }
            itemIds={items.unassigned}
            emptyHint="All questions are assigned."
          >
            {unassignedGroups.map((group) => (
              <div key={group.sectionId} className="mb-2 last:mb-0">
                <div
                  className="sticky top-0 z-10 flex items-center justify-between gap-1 px-3 py-1 backdrop-blur-sm"
                  style={{ background: "color-mix(in srgb, var(--bg-elevated) 90%, transparent)" }}
                >
                  <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                    {group.sectionTitle} ({group.ids.length})
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveAllInSection(group.sectionId, "left")}
                      className="text-[10px] px-1.5 py-0.5 rounded-badge"
                      style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                      title={`Move all to ${leftLabel}`}
                    >
                      <ArrowLeft size={10} className="inline" /> all
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAllInSection(group.sectionId, "right")}
                      className="text-[10px] px-1.5 py-0.5 rounded-badge"
                      style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                      title={`Move all to ${rightLabel}`}
                    >
                      all <ArrowRight size={10} className="inline" />
                    </button>
                  </div>
                </div>
                {group.ids.map((id) => {
                  const q = questionMap.get(id);
                  if (!q) return null;
                  return (
                    <ShuttleCard
                      key={id}
                      id={id}
                      title={q.title || "(no title)"}
                      sectionTitle={q.sectionTitle}
                      onMove={(target) => moveItem(id, target)}
                      currentSide="unassigned"
                    />
                  );
                })}
              </div>
            ))}
          </Column>

          <Column
            containerKey="right"
            header={
              <ColumnHeader
                tone="primary"
                value={rightLabel}
                placeholder="Right label"
                onChange={onRightLabelChange}
                count={items.right.length}
              />
            }
            itemIds={items.right}
            emptyHint="Drop questions here for the right set."
          >
            {items.right.map((id) => {
              const q = questionMap.get(id);
              if (!q) return null;
              return (
                <ShuttleCard
                  key={id}
                  id={id}
                  title={q.title || "(no title)"}
                  sectionTitle={q.sectionTitle}
                  onMove={(target) => moveItem(id, target)}
                  currentSide="right"
                />
              );
            })}
          </Column>
        </div>

        <DragOverlay>
          {activeId ? (
            <div
              className="px-3 py-2 rounded-button border text-sm font-medium shadow-card"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--primary)",
                color: "var(--text-primary)",
                maxWidth: 260,
              }}
            >
              {questionMap.get(activeId)?.title ?? "Question"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────

function Column({
  containerKey,
  header,
  itemIds,
  children,
  emptyHint,
}: {
  containerKey: ContainerKey;
  header: React.ReactNode;
  itemIds: string[];
  children: React.ReactNode;
  emptyHint: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerKey });
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-card border"
      style={{
        borderColor: isOver ? "var(--info)" : "var(--border)",
        background: isOver ? "var(--info-light)" : "var(--bg-elevated)",
        minHeight: 220,
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      {header}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 overflow-y-auto" style={{ maxHeight: 480 }}>
          {itemIds.length === 0 ? (
            <p className="text-xs italic text-center py-6" style={{ color: "var(--text-muted)" }}>
              {emptyHint}
            </p>
          ) : (
            children
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function ColumnHeader({
  tone,
  value,
  placeholder,
  onChange,
  count,
}: {
  tone: "primary" | "muted";
  value: string;
  placeholder: string;
  onChange?: (v: string) => void;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex-1 min-w-0">
        {onChange ? (
          <input
            type="text"
            defaultValue={value}
            onBlur={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input input-sm font-semibold"
            style={{
              background: "transparent",
              borderColor: "transparent",
              color: tone === "primary" ? "var(--primary)" : "var(--text-primary)",
            }}
            aria-label={placeholder}
          />
        ) : (
          <p className="text-sm font-semibold truncate" style={{ color: tone === "primary" ? "var(--primary)" : "var(--text-primary)" }}>
            {value || placeholder}
          </p>
        )}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{count} questions</p>
      </div>
      <ArrowLeftRight size={14} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
    </div>
  );
}

// ── Shuttle card ───────────────────────────────────────────────────

function ShuttleCard({
  id,
  title,
  sectionTitle,
  onMove,
  currentSide,
}: {
  id: string;
  title: string;
  sectionTitle: string;
  onMove: (target: ContainerKey) => void;
  currentSide: ContainerKey;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 mb-1.5 rounded-button border touch-none",
        "hover:shadow-subtle"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="btn-icon p-0.5 cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag question"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{sectionTitle}</p>
      </div>
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" aria-label="Move question">
        {currentSide !== "left" && (
          <button type="button" onClick={() => onMove("left")} className="btn-icon p-1" aria-label="Move to left">
            <ArrowLeft size={12} />
          </button>
        )}
        {currentSide !== "unassigned" && (
          <button type="button" onClick={() => onMove("unassigned")} className="btn-icon p-1 text-[10px]" aria-label="Unassign">
            ✕
          </button>
        )}
        {currentSide !== "right" && (
          <button type="button" onClick={() => onMove("right")} className="btn-icon p-1" aria-label="Move to right">
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
