"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KanbanSquare, Plus, Trash2 } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { formatEuro } from "@/components/ui/editor-panel/money";
import type { SalesBoard } from "@/types";

/** Tell SalesPanelNav to re-fetch its board list. */
export function notifyBoardsUpdated() {
  window.dispatchEvent(new Event("sales-boards-updated"));
}

function NewBoardForm({
  onCreated,
  onClose,
}: {
  onCreated: (b: SalesBoard) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/sales/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Bord aanmaken mislukt");
      return;
    }
    const created: SalesBoard = await res.json();
    onCreated(created);
    notifyBoardsUpdated();
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div>
        <label className="typo-label">
          Naam <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
          placeholder="bijv. Nieuwe business 2026"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="typo-label">Omschrijving</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Waar gaat dit bord over?"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <p className="typo-caption">
        Het bord start met vier standaardkolommen. Die kun je daarna aanpassen.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="btn-ghost">
          Annuleren
        </button>
        <button onClick={handleSubmit} disabled={saving || !name.trim()} className="btn-primary">
          {saving ? "Bezig…" : "Bord aanmaken"}
        </button>
      </div>
    </div>
  );
}

export default function SalesBoardsList({
  initialBoards,
  canManageBoards,
}: {
  initialBoards: SalesBoard[];
  canManageBoards: boolean;
}) {
  const [boards, setBoards] = useState(initialBoards);
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();

  function openNewBoard() {
    openPanel(
      "Nieuw bord",
      <NewBoardForm
        onCreated={(b) => setBoards((prev) => [...prev, b])}
        onClose={closePanel}
      />
    );
  }

  async function handleDelete(board: SalesBoard) {
    const count = board.cardCount ?? 0;
    const warning =
      count > 0
        ? `"${board.name}" verwijderen? De ${count} kaart${count === 1 ? "" : "en"} op dit bord verdwijnen mee. De clients zelf blijven bestaan.`
        : `"${board.name}" verwijderen?`;
    if (!confirm(warning)) return;

    const res = await fetch(`/api/sales/boards/${board.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setBoards((prev) => prev.filter((b) => b.id !== board.id));
    notifyBoardsUpdated();
    router.refresh();
  }

  if (boards.length === 0) {
    return (
      <div
        className="rounded-card border p-10 text-center"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <KanbanSquare size={28} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="typo-card-title mb-1" style={{ color: "var(--text-primary)" }}>
          Nog geen borden
        </p>
        <p className="typo-caption mb-5">
          Maak een bord aan om bij te houden in welke fase je prospects zitten.
        </p>
        {canManageBoards && (
          <button onClick={openNewBoard} className="btn-primary">
            <Plus size={14} className="inline mr-1.5 -mt-px" />
            Nieuw bord
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManageBoards && (
        <div className="flex justify-end">
          <button onClick={openNewBoard} className="btn-primary">
            <Plus size={14} className="inline mr-1.5 -mt-px" />
            Nieuw bord
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {boards.map((board) => (
          <div key={board.id} className="relative group">
            <Link
              href={`/sales/${board.id}`}
              className="block rounded-card border p-5 h-full transition-shadow hover:shadow-card"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <KanbanSquare size={17} strokeWidth={1.8} />
              </div>
              <p className="typo-card-title mb-1 pr-7" style={{ color: "var(--text-primary)" }}>
                {board.name}
              </p>
              {board.description && (
                <p className="typo-caption line-clamp-2 mb-3">{board.description}</p>
              )}
              <div className="flex items-baseline gap-3 mt-3">
                <span className="typo-body-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {board.cardCount ?? 0} prospect{(board.cardCount ?? 0) === 1 ? "" : "s"}
                </span>
                {(board.totalValue ?? 0) > 0 && (
                  <span className="typo-caption tabular-nums">{formatEuro(board.totalValue ?? 0)}</span>
                )}
              </div>
            </Link>
            {canManageBoards && (
              <button
                onClick={() => handleDelete(board)}
                aria-label={`${board.name} verwijderen`}
                className="btn-icon-danger absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
