"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X, ChevronRight } from "lucide-react";
import type { Archetype } from "@/types";
import { useRightPanel } from "@/components/layout/RightPanel";

interface TemplateRow {
  id: string;
  name: string;
  description?: string;
  status: string;
  archetypeIds: string[];
  sectionCount: number;
  questionCount: number;
  createdAt?: string;
}

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function NewTemplateForm({
  archetypes,
  onCreated,
  onClose,
}: {
  archetypes: Archetype[];
  onCreated: (t: TemplateRow) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(archetypes.map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleArchetype(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/surveys/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        archetypeIds: selectedIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to create");
      return;
    }
    const created = await res.json();
    onCreated({
      id: created.id,
      name: created.name,
      description: created.description,
      status: created.status,
      archetypeIds: created.archetypeIds,
      sectionCount: 0,
      questionCount: 0,
      createdAt: created.createdAt,
    });
    onClose();
    router.push(`/admin/surveys/${created.id}`);
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div>
        <label className="typo-label">
          Name <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cultural Archetype Survey"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="typo-label">Description (optional)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="typo-label">
          Archetypes <span className="text-[var(--danger)]">*</span>
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Pick the archetypes that participants will score against (min. 2).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {archetypes.map((a) => {
            const on = selectedIds.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleArchetype(a.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={{
                  background: on ? a.color : "var(--bg-hover)",
                  color: on ? "#fff" : "var(--text-muted)",
                  borderColor: on ? a.color : "var(--border)",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: on ? "rgba(255,255,255,0.9)" : a.color }}
                />
                {a.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !name.trim() || selectedIds.length < 2}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Creating…" : "Create template"}
        </button>
        <button type="button" onClick={onClose} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm btn-ghost">
          <X size={13} />
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminSurveyTemplatesTable({
  initialTemplates,
  archetypes,
}: {
  initialTemplates: TemplateRow[];
  archetypes: Archetype[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [error, setError] = useState("");
  const { openPanel, closePanel } = useRightPanel();

  function openNewPanel() {
    openPanel(
      "New survey template",
      <NewTemplateForm
        archetypes={archetypes}
        onCreated={(t) => setTemplates((prev) => [t, ...prev])}
        onClose={closePanel}
      />
    );
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? Sessions that already use this template keep working via their snapshot, but you can't create new sessions from it. This cannot be undone.`))
      return;
    const res = await fetch(`/api/surveys/templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to delete");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  return (
    <div className="px-7 pt-6 pb-7">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Survey templates
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Globale survey-templates met secties, vragen en gap-vergelijkingen.
          </p>
        </div>
        <button
          onClick={openNewPanel}
          className="btn-primary rounded-lg text-sm px-4 py-2.5 inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          New template
        </button>
      </div>

      {error && <p className="text-xs text-[var(--danger)] mb-2">{error}</p>}

      {templates.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>No templates yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Create your first template to start running surveys.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/admin/surveys/${t.id}`}
              className="group block rounded-xl border transition-all hover:shadow-card"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div className="flex items-center justify-between p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                      {t.name}
                    </h2>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: t.status === "active" ? "var(--success-light)" : "var(--bg-hover)",
                        color: t.status === "active" ? "var(--success)" : "var(--text-muted)",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{t.archetypeIds.length} archetypes</span>
                    <span>{t.sectionCount} sections</span>
                    <span>{t.questionCount} questions</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/admin/surveys/${t.id}`);
                    }}
                    className="btn-icon p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(t.id, t.name);
                    }}
                    className="btn-icon p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:!text-[var(--danger)]"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
