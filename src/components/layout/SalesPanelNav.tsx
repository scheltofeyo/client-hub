"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KanbanSquare, LayoutGrid } from "lucide-react";
import type { SalesBoard } from "@/types";

export default function SalesPanelNav() {
  const pathname = usePathname();
  const [boards, setBoards] = useState<SalesBoard[]>([]);

  // Boards are created from the page body, so refresh on the same window event
  // the board list dispatches (mirrors AdminPanelNav's employee list).
  useEffect(() => {
    function load() {
      fetch("/api/sales/boards")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: SalesBoard[]) => setBoards(data))
        .catch(() => {});
    }
    load();
    window.addEventListener("sales-boards-updated", load);
    return () => window.removeEventListener("sales-boards-updated", load);
  }, []);

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Section header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          Sales
        </span>
      </div>

      {/* Section nav */}
      <div className="px-2 space-y-0.5">
        <Link
          href="/sales"
          data-active={pathname === "/sales"}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
        >
          <LayoutGrid size={14} strokeWidth={1.8} />
          Alle borden
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-3 my-3 border-t" style={{ borderColor: "var(--border)" }} />

      {boards.length > 0 && (
        <div className="px-2 space-y-0.5 pb-3">
          <div className="px-2 pb-1.5 typo-section-header" style={{ color: "var(--text-muted)" }}>
            Borden
          </div>
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/sales/${board.id}`}
              data-active={pathname === `/sales/${board.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
            >
              <KanbanSquare size={14} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{board.name}</span>
              {(board.cardCount ?? 0) > 0 && (
                <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {board.cardCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
