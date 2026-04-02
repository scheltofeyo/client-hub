"use client";

import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

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
}

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
      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap text-left transition-colors"
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
}: DataTableProps<T>) {
  const totalMinWidth = columns.reduce((sum, col) => sum + col.minWidth, 0);

  return (
    <div>
      {filterBar}

      {/*
        Grid wrapper: minmax(0, 1fr) forces this cell to be bounded by the
        parent's available width, regardless of how wide the table content is.
        Without this, overflow-x-auto has nothing to scroll against because
        its own width expands to match the table content.
      */}
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
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-left"
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
              {rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className="group transition-colors"
                  style={{
                    borderTop: "1px solid var(--border)",
                    cursor: onRowClick ? "pointer" : undefined,
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
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
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
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
    </div>
  );
}
