"use client";

import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──────────────────────────────────────────────────────────────────

export type SortDir = "asc" | "desc";

export interface SortState {
  col: string | null;
  dir: SortDir;
}

export interface ColumnDef<T> {
  key: string;
  label: string;
  minWidth: number;
  sortable?: boolean;
  sticky?: boolean;   // pins column to the left edge during horizontal scroll
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  sort: SortState;
  onSort: (col: string) => void;
  onRowClick?: (row: T) => void;
  filterBar?: React.ReactNode;
  emptyMessage?: string;
  /**
   * When provided, rows become drag-and-drop sortable (a grip handle appears in a
   * leading column on hover). The callback receives the reordered row keys.
   */
  onReorder?: (ids: string[]) => void;
}

const GRIP_COL_WIDTH = 36;

// ── SortHeader ─────────────────────────────────────────────────────────────

function SortHeader({
  col,
  label,
  minWidth,
  sticky,
  sort,
  onSort,
}: {
  col: string;
  label: string;
  minWidth: number;
  sticky?: boolean;
  sort: SortState;
  onSort: (col: string) => void;
}) {
  const active = sort.col === col;
  return (
    <th
      className="px-4 py-3 typo-section-header cursor-pointer select-none whitespace-nowrap text-left transition-colors"
      style={{
        color: active ? "var(--primary)" : "var(--text-muted)",
        minWidth,
        background: "var(--bg-elevated)",
        ...(sticky && {
          position: "sticky",
          left: 0,
          zIndex: 3,
          boxShadow: "2px 0 4px -1px rgba(0,0,0,0.06)",
        }),
      }}
      onClick={() => onSort(col)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = active ? "var(--primary)" : "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = active ? "var(--primary)" : "var(--text-muted)";
      }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronsUpDown size={12} strokeWidth={1.5} style={{ opacity: 0.4 }} />
        )}
      </span>
    </th>
  );
}

// ── Row cells ──────────────────────────────────────────────────────────────

function RowCells<T>({ columns, row }: { columns: ColumnDef<T>[]; row: T }) {
  return (
    <>
      {columns.map((col) => (
        <td
          key={col.key}
          className="px-4 py-3"
          style={col.sticky ? {
            position: "sticky",
            left: 0,
            zIndex: 1,
            background: "var(--bg-surface)",
            boxShadow: "2px 0 4px -1px rgba(0,0,0,0.06)",
          } : undefined}
        >
          {col.render(row)}
        </td>
      ))}
    </>
  );
}

// ── SortableRow ──────────────────────────────────────────────────────────────

function SortableRow<T>({
  id,
  columns,
  row,
  onRowClick,
}: {
  id: string;
  columns: ColumnDef<T>[];
  row: T;
  onRowClick?: (row: T) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <tr
      ref={setNodeRef}
      className="group transition-colors"
      style={{
        borderTop: "1px solid var(--border)",
        cursor: onRowClick ? "pointer" : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: isDragging ? "relative" : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      <td className="pl-3 pr-1 py-3 align-middle" style={{ width: GRIP_COL_WIDTH }}>
        <span
          className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ color: "var(--text-muted)" }}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </span>
      </td>
      <RowCells columns={columns} row={row} />
    </tr>
  );
}

// ── DataTable ──────────────────────────────────────────────────────────────

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  sort,
  onSort,
  onRowClick,
  filterBar,
  emptyMessage,
  onReorder,
}: DataTableProps<T>) {
  const sortable = !!onReorder && rows.length > 1;
  const totalMinWidth =
    columns.reduce((sum, col) => sum + col.minWidth, 0) + (onReorder ? GRIP_COL_WIDTH : 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = rows.map(getRowKey);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div>
      {filterBar}

      {/*
        Grid wrapper: minmax(0, 1fr) forces this cell to be bounded by the
        parent's available width, regardless of how wide the table content is.
        Without this, overflow-x-auto has nothing to scroll against because
        its own width expands to match the table content.
      */}
      <DndWrapper
        enabled={sortable}
        sensors={sensors}
        onDragEnd={handleDragEnd}
      >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div
          className="rounded-xl border overflow-x-auto"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <table style={{ minWidth: totalMinWidth, width: "100%", fontSize: "0.875rem" }}>
            <thead
              className="sticky top-0 z-10"
              style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}
            >
              <tr>
                {onReorder && (
                  <th
                    aria-hidden
                    style={{ width: GRIP_COL_WIDTH, background: "var(--bg-elevated)" }}
                  />
                )}
                {columns.map((col) =>
                  col.sortable ? (
                    <SortHeader
                      key={col.key}
                      col={col.key}
                      label={col.label}
                      minWidth={col.minWidth}
                      sticky={col.sticky}
                      sort={sort}
                      onSort={onSort}
                    />
                  ) : (
                    <th
                      key={col.key}
                      className="px-4 py-3 typo-section-header whitespace-nowrap text-left"
                      style={{
                        color: "var(--text-muted)",
                        minWidth: col.minWidth,
                        background: "var(--bg-elevated)",
                        ...(col.sticky && {
                          position: "sticky",
                          left: 0,
                          zIndex: 3,
                          boxShadow: "2px 0 4px -1px rgba(0,0,0,0.06)",
                        }),
                      }}
                    >
                      {col.label}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {sortable ? (
                <SortableContext items={rows.map(getRowKey)} strategy={verticalListSortingStrategy}>
                  {rows.map((row) => (
                    <SortableRow
                      key={getRowKey(row)}
                      id={getRowKey(row)}
                      columns={columns}
                      row={row}
                      onRowClick={onRowClick}
                    />
                  ))}
                </SortableContext>
              ) : (
                rows.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    className="group transition-colors"
                    style={{
                      borderTop: "1px solid var(--border)",
                      cursor: onRowClick ? "pointer" : undefined,
                    }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {onReorder && <td style={{ width: GRIP_COL_WIDTH }} />}
                    <RowCells columns={columns} row={row} />
                  </tr>
                ))
              )}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + (onReorder ? 1 : 0)}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {emptyMessage ?? "No results"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </DndWrapper>
    </div>
  );
}

function DndWrapper({
  enabled,
  sensors,
  onDragEnd,
  children,
}: {
  enabled: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
