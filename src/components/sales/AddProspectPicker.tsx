"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { clientColor } from "@/lib/styles";
import type { ProspectOption, SalesCard } from "@/types";

export default function AddProspectPicker({
  boardId,
  columnId,
  prospects,
  existingClientIds,
  onAdded,
  onClose,
}: {
  boardId: string;
  columnId: string;
  prospects: ProspectOption[];
  existingClientIds: string[];
  onAdded: (card: SalesCard) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const onBoard = useMemo(() => new Set(existingClientIds), [existingClientIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) => p.company.toLowerCase().includes(q));
  }, [prospects, query]);

  async function add(prospect: ProspectOption) {
    setSavingId(prospect.id);
    setError("");
    const res = await fetch(`/api/sales/boards/${boardId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: prospect.id, columnId }),
    });
    setSavingId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Toevoegen mislukt");
      return;
    }
    onAdded(await res.json());
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Zoek een prospect"
          className={`${inputClass} pl-9`}
          style={inputStyle}
        />
      </div>

      {prospects.length === 0 ? (
        <p className="typo-caption py-6 text-center">
          Er zijn nog geen clients met de status prospect. Maak er eerst een aan op de clients-pagina.
        </p>
      ) : filtered.length === 0 ? (
        <p className="typo-caption py-6 text-center">Geen prospect gevonden voor &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((prospect) => {
            const already = onBoard.has(prospect.id);
            const color = clientColor({ company: prospect.company, primaryColor: prospect.primaryColor });
            return (
              <button
                key={prospect.id}
                onClick={() => !already && add(prospect)}
                disabled={already || savingId !== null}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors disabled:cursor-default hover-row"
                style={{ opacity: already ? 0.45 : 1 }}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: color.bg, color: color.fg }}
                >
                  {prospect.company.slice(0, 2).toUpperCase()}
                </span>
                <span className="typo-body truncate flex-1" style={{ color: "var(--text-primary)" }}>
                  {prospect.company}
                </span>
                {already && (
                  <span className="typo-caption inline-flex items-center gap-1 shrink-0">
                    <Check size={12} /> Staat er al op
                  </span>
                )}
                {savingId === prospect.id && <span className="typo-caption shrink-0">Bezig…</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="btn-ghost">
          Sluiten
        </button>
      </div>
    </div>
  );
}
