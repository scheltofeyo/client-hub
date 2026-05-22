"use client";

import { useState, useMemo } from "react";
import { Check, X } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import type { KudosCategory } from "@/types";

interface AssignableUser { id: string; name: string; image: string | null }

export default function KudosForm({
  users,
  categories,
  onSubmit,
}: {
  users: AssignableUser[];
  categories: KudosCategory[];
  onSubmit: (payload: { toUserIds: string[]; message: string; categoryId?: string }) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedIds.length === 0) {
      setError("Kies minstens één collega");
      return;
    }
    if (!message.trim()) {
      setError("Bericht is verplicht");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        toUserIds: selectedIds,
        message: message.trim(),
        categoryId: categoryId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon kudo niet versturen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Recipients */}
      <div>
        <label className="typo-label">Aan welke collega&apos;s?</label>
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedIds.map((id) => {
              const u = users.find((x) => x.id === id);
              if (!u) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full text-xs"
                  style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                >
                  <UserAvatar name={u.name} image={u.image} size={18} />
                  {u.name}
                  <button
                    type="button"
                    onClick={() => toggleUser(id)}
                    className="hover:opacity-70"
                    aria-label={`Verwijder ${u.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <input
          type="text"
          placeholder="Zoek collega…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <div
          className="mt-2 max-h-56 overflow-y-auto rounded-md border"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          {filteredUsers.length === 0 ? (
            <p className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Geen collega&apos;s gevonden.
            </p>
          ) : (
            filteredUsers.map((u) => {
              const selected = selectedIds.includes(u.id);
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-hover transition-colors"
                  style={{ color: "var(--text-primary)" }}
                >
                  <UserAvatar name={u.name} image={u.image} size={22} />
                  <span className="flex-1">{u.name}</span>
                  {selected && <Check size={16} style={{ color: "var(--primary)" }} />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="typo-label">Categorie (optioneel)</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryId("")}
            className="px-3 py-1 rounded-full text-xs border transition-colors"
            style={{
              background: categoryId === "" ? "var(--primary-light)" : "var(--bg-surface)",
              borderColor: categoryId === "" ? "var(--primary)" : "var(--border)",
              color: categoryId === "" ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            Geen
          </button>
          {categories.map((c) => {
            const selected = categoryId === c.id;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className="px-3 py-1 rounded-full text-xs border transition-colors"
                style={{
                  background: selected ? c.color + "22" : "var(--bg-surface)",
                  borderColor: selected ? c.color : "var(--border)",
                  color: selected ? c.color : "var(--text-muted)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="typo-label">Bericht</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={5}
          placeholder="Waarvoor verdient deze collega een schouderklopje?"
          className="w-full px-3 py-2 rounded-md border text-sm resize-none"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <p className="text-xs mt-1 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
          {message.length}/500
        </p>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || selectedIds.length === 0 || !message.trim()}
          className="btn-primary"
          style={{ opacity: submitting || selectedIds.length === 0 || !message.trim() ? 0.6 : 1 }}
        >
          {submitting ? "Versturen…" : "Versturen"}
        </button>
      </div>
    </form>
  );
}
