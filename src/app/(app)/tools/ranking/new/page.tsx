"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useRightPanel } from "@/components/layout/RightPanel";
import { Plus, Pencil, Trash2, ChevronRight, ClipboardPaste } from "lucide-react";
import { ClientDropdown, type ClientOption } from "@/components/ranking/ClientDropdown";
import { parseCulturalDnaTsv } from "@/lib/ranking/parseTsv";
import type { CulturalDnaValue } from "@/types";

const DEFAULT_COLORS = [
  "#7C5CFC", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#8B5CF6", "#6366F1", "#14B8A6",
];

// ── main page ────────────────────────────────────────────────────────────

export default function CreateRankingSessionPage() {
  const router = useRouter();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showBehaviors, setShowBehaviors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DNA wizard state (when client has no DNA)
  const [wizardDna, setWizardDna] = useState<CulturalDnaValue[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { openPanel, closePanel } = useRightPanel();

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        setClients(
          data
            .map((c: { id: string; company: string; culturalDna?: CulturalDnaValue[]; leads?: { userId: string; name: string; email: string }[] }) => ({
              id: c.id,
              company: c.company,
              culturalDna: c.culturalDna ?? [],
              leads: c.leads ?? [],
            }))
            .sort((a: ClientOption, b: ClientOption) => a.company.localeCompare(b.company))
        );
        setLoading(false);
      });
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const clientDna = selectedClient?.culturalDna ?? [];
  const hasDna = clientDna.length >= 2;

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId);
    setShowWizard(false);
    setWizardDna([]);
    setError(null);
  }

  function openAddValuePanel() {
    openPanel(
      "Add value",
      <WizardDnaValueForm
        defaultColor={DEFAULT_COLORS[wizardDna.length % DEFAULT_COLORS.length]}
        onSave={(value) => {
          setWizardDna((prev) => [...prev, value]);
          closePanel();
        }}
        onCancel={closePanel}
      />
    );
  }

  function openEditValuePanel(value: CulturalDnaValue) {
    openPanel(
      "Edit value",
      <WizardDnaValueForm
        initial={value}
        onSave={(updated) => {
          setWizardDna((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
          closePanel();
        }}
        onCancel={closePanel}
        onDelete={() => {
          setWizardDna((prev) => prev.filter((v) => v.id !== value.id));
          closePanel();
        }}
      />
    );
  }

  async function handleSaveDnaAndCreate() {
    const validValues = wizardDna.filter((v) => v.title.trim());
    if (validValues.length < 2) {
      setError("Add at least 2 values.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a session title.");
      return;
    }

    setSaving(true);
    setError(null);

    const dnaRes = await fetch(`/api/clients/${selectedClientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ culturalDna: validValues }),
    });
    if (!dnaRes.ok) {
      setError("Could not save values to the client.");
      setSaving(false);
      return;
    }

    const sessionRes = await fetch("/api/ranking-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId, title: title.trim(), description: description.trim() || undefined, showBehaviors }),
    });
    if (!sessionRes.ok) {
      const data = await sessionRes.json();
      setError(data.error ?? "Could not create session.");
      setSaving(false);
      return;
    }

    const session = await sessionRes.json();
    router.push(`/tools/ranking/${session.id}`);
  }

  async function handleCreate() {
    if (!selectedClientId || !title.trim()) {
      setError("Select a client and enter a title.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/ranking-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId, title: title.trim(), description: description.trim() || undefined, showBehaviors }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not create session.");
      setSaving(false);
      return;
    }

    const session = await res.json();
    router.push(`/tools/ranking/${session.id}`);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Ranking the Values", href: "/tools/ranking" }, { label: "New session" }]}
        title="New session"
      />

      <div className="px-7 pb-7 pt-5 max-w-2xl">
        {/* Client picker */}
        <div className="mb-5">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Client *</label>
          <ClientDropdown
            clients={clients}
            selectedClientId={selectedClientId}
            onSelect={handleClientSelect}
            loading={loading}
          />
        </div>

        {/* DNA preview or wizard */}
        {selectedClient && (
          <>
            {hasDna ? (
              <div className="mb-5 p-4 rounded-card border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                <h3 className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
                  Cultural DNA ({clientDna.length} values)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {clientDna.map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-badge text-xs font-medium"
                      style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                      {v.title}
                    </span>
                  ))}
                </div>
              </div>
            ) : !showWizard ? (
              <div className="mb-5 p-5 rounded-card border text-center" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  {selectedClient.company} does not have cultural DNA yet.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => { setShowWizard(true); openAddValuePanel(); }}
                    className="btn-primary rounded-lg text-sm px-4 py-2 inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Add values
                  </button>
                  <button
                    onClick={() => { setShowWizard(true); setShowImport(true); }}
                    className="btn-secondary border rounded-lg text-sm px-4 py-2 inline-flex items-center gap-1.5"
                  >
                    <ClipboardPaste size={14} />
                    Import from spreadsheet
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-5 p-4 rounded-card border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                    Cultural DNA ({wizardDna.length} {wizardDna.length === 1 ? "value" : "values"})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 text-xs py-1.5 px-2 rounded-lg btn-tertiary">
                      <ClipboardPaste size={12} />
                      Import
                    </button>
                    <button onClick={openAddValuePanel} className="flex items-center gap-1.5 text-xs py-1.5 px-2 rounded-lg btn-tertiary">
                      <Plus size={12} />
                      Add value
                    </button>
                  </div>
                </div>
                {wizardDna.length === 0 ? (
                  <p className="text-sm py-3 text-center" style={{ color: "var(--text-muted)" }}>
                    No values added yet. Click &ldquo;Add value&rdquo; to get started.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {wizardDna.map((value) => (
                      <div
                        key={value.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-button group transition-colors"
                        style={{ background: "var(--bg-surface)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: value.color }} />
                        <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                          {value.title}
                        </span>
                        {value.mantra && (
                          <span className="text-xs truncate max-w-[140px]" style={{ color: "var(--text-muted)" }}>
                            {value.mantra}
                          </span>
                        )}
                        <button
                          onClick={() => openEditValuePanel(value)}
                          className="btn-icon p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Session details */}
            {(hasDna || showWizard) && (
              <>
                <div className="mb-4">
                  <label className="typo-label" style={{ color: "var(--text-muted)" }}>Session title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Quarterly values session Q2 2026"
                    className="w-full px-3 py-2 rounded-button border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>

                <div className="mb-5">
                  <label className="typo-label" style={{ color: "var(--text-muted)" }}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional context for participants"
                    rows={2}
                    className="w-full px-3 py-2 rounded-button border text-sm resize-none"
                    style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Show behaviors toggle — only if client has behavior data */}
                {clientDna.some((v) => v.behaviors && v.behaviors.length > 0) && (
                  <div className="mb-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowBehaviors(!showBehaviors)}
                      className="relative w-9 h-5 rounded-full transition-colors"
                      style={{ background: showBehaviors ? "var(--primary)" : "var(--border-strong)" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{ transform: showBehaviors ? "translateX(16px)" : "translateX(0)" }}
                      />
                    </button>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      Show behavioral examples to participants
                    </span>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={showWizard ? handleSaveDnaAndCreate : handleCreate}
                  disabled={saving}
                  className="btn-primary rounded-lg text-sm px-5 py-2.5 inline-flex items-center gap-1.5"
                >
                  {saving ? "Creating..." : "Create session"}
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <WizardImportModal
          onConfirm={(values) => {
            setWizardDna((prev) => [...prev, ...values]);
            setShowImport(false);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

// ── Wizard import modal ─────────────────────────────────────────────

function WizardImportModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (values: CulturalDnaValue[]) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCulturalDnaTsv> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function handleParse() {
    setError(null);
    const result = parseCulturalDnaTsv(raw);
    if (result.values.length === 0) {
      setError("No values found. Paste tab-separated content with columns: Title, Mantra, Description, [Levels...]");
      return;
    }
    setParsed(result);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-card shadow-dropdown flex flex-col"
        style={{ background: "var(--bg-surface)", maxHeight: "85vh" }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="typo-modal-title" style={{ color: "var(--text-primary)" }}>
            Import from spreadsheet
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Paste tab-separated content (TSV) from Google Sheets. Columns: Title, Mantra, Description, then one column per behavior level.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!parsed ? (
            <>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={"Creativity\tWe think outside the box\tWe encourage...\t\"- Bullet 1\\n- Bullet 2\"\t..."}
                rows={10}
                autoFocus
                className="w-full px-3 py-2 rounded-button border text-sm font-mono resize-none"
                style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
              />
              {error && (
                <div className="p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}
            </>
          ) : (
            <div className="p-3 rounded-card border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                  {parsed.values.length} values found
                </span>
                {parsed.levels.length > 0 && (
                  <span className="px-2 py-0.5 rounded-badge text-[10px] font-medium" style={{ background: "var(--info-light)", color: "var(--info)" }}>
                    {parsed.levels.length} levels: {parsed.levels.join(", ")}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {parsed.values.map((v) => (
                  <div key={v.id} className="flex items-center gap-2.5 px-3 py-2 rounded-button" style={{ background: "var(--bg-surface)" }}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                    <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{v.title}</span>
                    {v.mantra && <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-muted)" }}>{v.mantra}</span>}
                    {(v.behaviors?.length ?? 0) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-badge shrink-0" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                        {v.behaviors!.length} levels
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border)" }}>
          {parsed && (
            <button onClick={() => { setParsed(null); setError(null); }} className="btn-ghost rounded-lg px-4 py-2 text-sm mr-auto">
              Back
            </button>
          )}
          <button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">Cancel</button>
          {!parsed ? (
            <button onClick={handleParse} disabled={!raw.trim()} className="btn-primary rounded-lg px-4 py-2 text-sm">
              Parse
            </button>
          ) : (
            <button onClick={() => onConfirm(parsed.values)} className="btn-primary rounded-lg px-4 py-2 text-sm">
              Import {parsed.values.length} values
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DNA value form (right panel) ────────────────────────────────────

function WizardDnaValueForm({
  initial,
  defaultColor,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: CulturalDnaValue;
  defaultColor?: string;
  onSave: (value: CulturalDnaValue) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.color ?? defaultColor ?? DEFAULT_COLORS[0]);
  const [mantra, setMantra] = useState(initial?.mantra ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      color,
      mantra: mantra.trim(),
      description: description.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Title */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ownership"
            autoFocus
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Color */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Color</label>
          <div className="flex gap-2 flex-wrap">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "var(--text-primary)" : "transparent",
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
            <label
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute w-8 h-8 opacity-0 cursor-pointer"
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>+</span>
            </label>
          </div>
        </div>

        {/* Mantra */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Mantra</label>
          <input
            type="text"
            value={mantra}
            onChange={(e) => setMantra(e.target.value)}
            placeholder="Short tagline"
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this value mean for the company?"
            rows={3}
            className="w-full px-3 py-2 rounded-button border text-sm resize-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-icon p-2 rounded-lg hover:!text-[var(--danger)] hover:!bg-[var(--danger-light)]"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="btn-ghost rounded-lg px-4 py-2 text-sm">
          Cancel
        </button>
        <button type="submit" disabled={!title.trim()} className="btn-primary rounded-lg px-4 py-2 text-sm">
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}
