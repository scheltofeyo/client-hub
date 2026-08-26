"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import EditorPanel from "@/components/ui/editor-panel/EditorPanel";
import PanelSection from "@/components/ui/editor-panel/PanelSection";
import { useEditorDraft } from "@/components/ui/editor-panel/useEditorDraft";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { SalesBoard } from "@/types";

type Tab = "general" | "columns";

const COLOR_PRESETS = [
  "#94A3B8", "#7C3AED", "#2563EB", "#0891B2",
  "#059669", "#F59E0B", "#EA580C", "#DC2626",
];

/** A column without an id is new — the API mints one on save. */
type DraftColumn = { id: string; title: string; color: string; key: string };

interface BoardDraft {
  name: string;
  description: string;
  columns: DraftColumn[];
}

function SortableColumnRow({
  column,
  cardCount,
  onChange,
  onRemove,
}: {
  column: DraftColumn;
  cardCount: number;
  onChange: (patch: Partial<DraftColumn>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.key,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: isDragging ? "relative" : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="group flex items-center gap-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Kolom verslepen"
        className="shrink-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-muted)" }}
      >
        <GripVertical size={14} />
      </button>

      <input
        type="color"
        value={column.color}
        onChange={(e) => onChange({ color: e.target.value })}
        aria-label="Kolomkleur"
        className="w-7 h-7 rounded-lg border shrink-0 cursor-pointer"
        style={{ borderColor: "var(--border)", background: "transparent" }}
      />

      <input
        type="text"
        value={column.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Kolomnaam"
        className={inputClass}
        style={inputStyle}
      />

      <span className="typo-caption tabular-nums shrink-0 w-8 text-right">{cardCount}</span>

      <button
        type="button"
        onClick={onRemove}
        disabled={cardCount > 0}
        title={cardCount > 0 ? "Verplaats eerst de kaarten uit deze kolom" : "Kolom verwijderen"}
        aria-label="Kolom verwijderen"
        className="btn-icon-danger shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function BoardSettingsEditor({
  board,
  cardCountByColumn,
  onUpdated,
  onClose,
}: {
  board: SalesBoard;
  cardCountByColumn: Record<string, number>;
  onUpdated: (board: SalesBoard) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("general");
  const [error, setError] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(0);

  const { display, dirty, saving, setField, discard, save } = useEditorDraft<BoardDraft>({
    name: board.name,
    description: board.description ?? "",
    columns: board.columns.map((c) => ({ id: c.id, title: c.title, color: c.color, key: c.id })),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const keys = display.columns.map((c) => c.key);
    const oldIndex = keys.indexOf(active.id as string);
    const newIndex = keys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    setField("columns", arrayMove(display.columns, oldIndex, newIndex));
  }

  function addColumn() {
    const key = `new-${nextKey}`;
    setNextKey((k) => k + 1);
    setField("columns", [...display.columns, { id: "", title: "", color: "#94A3B8", key }]);
  }

  async function handleSave() {
    setError(null);
    if (display.columns.length === 0) {
      setError("Een bord heeft minstens één kolom nodig");
      return;
    }
    await save(async (pending) => {
      const body: Record<string, unknown> = {};
      if (pending.name !== undefined) body.name = pending.name;
      if (pending.description !== undefined) body.description = pending.description;
      if (pending.columns !== undefined) {
        body.columns = (pending.columns as DraftColumn[]).map((c) => ({
          id: c.id || undefined,
          title: c.title,
          color: c.color,
        }));
      }

      const res = await fetch(`/api/sales/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Opslaan mislukt");
        return null;
      }
      const updated: SalesBoard = await res.json();
      onUpdated(updated);
      window.dispatchEvent(new Event("sales-boards-updated"));
      onClose();
      return pending;
    });
  }

  const columnsWithCounts: (DraftColumn & { count: number })[] = display.columns.map((c) => ({
    ...c,
    count: c.id ? (cardCountByColumn[c.id] ?? 0) : 0,
  }));

  return (
    <EditorPanel<Tab>
      tabs={[
        { key: "general", label: "Algemeen" },
        { key: "columns", label: "Kolommen", count: display.columns.length },
      ]}
      activeTab={tab}
      onTabChange={setTab}
      dirty={dirty}
      saving={saving}
      readOnly={false}
      onSave={handleSave}
      onDiscard={discard}
      error={error}
    >
      <div className="p-6 space-y-8">
        {tab === "general" && (
          <PanelSection title="Bord">
            <div>
              <label className="typo-label">
                Naam <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={display.name}
                onChange={(e) => setField("name", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="typo-label">Omschrijving</label>
              <textarea
                value={display.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </PanelSection>
        )}

        {tab === "columns" && (
          <PanelSection
            title="Kolommen"
            description="De fases van je funnel. Sleep om de volgorde te wijzigen."
            action={
              <button type="button" onClick={addColumn} className="btn-tertiary">
                <Plus size={13} className="inline mr-1 -mt-px" />
                Kolom
              </button>
            }
          >
            <div className="flex items-center gap-2 pl-6 pr-1">
              <span className="typo-section-header flex-1" style={{ color: "var(--text-muted)" }}>
                Naam
              </span>
              <span className="typo-section-header w-8 text-right" style={{ color: "var(--text-muted)" }}>
                #
              </span>
              <span className="w-7" />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={columnsWithCounts.map((c) => c.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {columnsWithCounts.map((column, index) => (
                    <SortableColumnRow
                      key={column.key}
                      column={column}
                      cardCount={column.count}
                      onChange={(patch) =>
                        setField(
                          "columns",
                          display.columns.map((c, i) => (i === index ? { ...c, ...patch } : c))
                        )
                      }
                      onRemove={() =>
                        setField(
                          "columns",
                          display.columns.filter((_, i) => i !== index)
                        )
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {COLOR_PRESETS.map((c) => (
                <span
                  key={c}
                  className="w-5 h-5 rounded-md border"
                  style={{ background: c, borderColor: "var(--border)" }}
                  title={c}
                />
              ))}
            </div>
            <p className="typo-caption">
              Kolommen met kaarten kunnen niet verwijderd worden. Verplaats die kaarten eerst.
            </p>
          </PanelSection>
        )}
      </div>
    </EditorPanel>
  );
}
