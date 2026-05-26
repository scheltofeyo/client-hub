"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

interface TermsSection {
  id: string;
  slug: string;
  titleNL: string;
  titleEN: string;
  contentNL: string;
  contentEN: string;
  rank: number;
}

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export default function DocumentsAdmin() {
  const [rows, setRows] = useState<TermsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/proposal-terms");
      if (cancelled) return;
      if (res.ok) {
        const data: TermsSection[] = await res.json();
        setRows(data.sort((a, b) => a.rank - b.rank));
      } else {
        setError("Failed to load terms");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addRow() {
    const newSlug = `term-${Date.now()}`;
    const res = await fetch("/api/proposal-terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newSlug,
        titleNL: "Nieuwe sectie",
        titleEN: "New section",
        contentNL: "",
        contentEN: "",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to add row");
      return;
    }
    const created: TermsSection = await res.json();
    setRows((prev) => [...prev, created]);
    setOpenRow(created.id);
  }

  async function updateRow(id: string, patch: Partial<TermsSection>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch(`/api/proposal-terms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteRow(id: string) {
    if (!confirm("Verwijder deze sectie?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/proposal-terms/${id}`, { method: "DELETE" });
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    setRows(next);
    await fetch("/api/proposal-terms/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((r) => r.id) }),
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Documents" }]}
        title="Documents"
        actions={
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
          >
            <Plus size={14} />
            Add section
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-7 max-w-4xl">
          <h2 className="typo-section-title mb-2" style={{ color: "var(--text-primary)" }}>
            Terms and conditions
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Beheer de juridische sub-secties van het voorstel — tweetalig (NL + EN). De rangschikking bepaalt de
            volgorde op de publieke pagina en in de PDF.
          </p>

          {error && (
            <p className="text-sm px-4 py-3 mb-4 rounded-lg bg-danger-light text-danger">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-text-muted">Laden…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-muted">Nog geen secties. Klik &quot;Add section&quot; om te beginnen.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const isOpen = openRow === row.id;
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border bg-surface"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setOpenRow(isOpen ? null : row.id)}
                        className="flex-1 text-left flex items-center gap-3 min-w-0"
                      >
                        <span className="text-xs tabular-nums text-text-muted w-5">{idx + 1}</span>
                        <span className="font-medium text-text-primary truncate">{row.titleNL}</span>
                        <span className="text-xs text-text-muted truncate">/ {row.titleEN}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => move(row.id, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(row.id, 1)}
                        disabled={idx === rows.length - 1}
                        className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="px-4 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="typo-label">Slug (intern)</label>
                            <input
                              type="text"
                              value={row.slug}
                              onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, slug: e.target.value } : r))}
                              onBlur={(e) => updateRow(row.id, { slug: e.target.value.trim() })}
                              className={inputClass}
                              style={inputStyle}
                            />
                          </div>
                          <div />
                          <div>
                            <label className="typo-label">Titel (NL)</label>
                            <input
                              type="text"
                              value={row.titleNL}
                              onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, titleNL: e.target.value } : r))}
                              onBlur={(e) => updateRow(row.id, { titleNL: e.target.value.trim() })}
                              className={inputClass}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label className="typo-label">Title (EN)</label>
                            <input
                              type="text"
                              value={row.titleEN}
                              onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, titleEN: e.target.value } : r))}
                              onBlur={(e) => updateRow(row.id, { titleEN: e.target.value.trim() })}
                              className={inputClass}
                              style={inputStyle}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="typo-label">Inhoud (NL)</label>
                            <textarea
                              rows={5}
                              value={row.contentNL}
                              onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, contentNL: e.target.value } : r))}
                              onBlur={(e) => updateRow(row.id, { contentNL: e.target.value })}
                              className={inputClass}
                              style={inputStyle}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="typo-label">Content (EN)</label>
                            <textarea
                              rows={5}
                              value={row.contentEN}
                              onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, contentEN: e.target.value } : r))}
                              onBlur={(e) => updateRow(row.id, { contentEN: e.target.value })}
                              className={inputClass}
                              style={inputStyle}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-text-muted flex items-center gap-1.5">
                          <Save size={11} /> Wijzigingen worden automatisch opgeslagen wanneer een veld de focus verliest.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
