"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { ClientDropdown, type ClientOption } from "@/components/ranking/ClientDropdown";
import type { CulturalDnaValue } from "@/types";

export default function EditRankingSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showBehaviors, setShowBehaviors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch(`/api/ranking-sessions/${id}`).then((r) => r.json()),
    ]).then(([clientsData, sessionData]) => {
      if (sessionData.status !== "draft") {
        router.push(`/tools/ranking/${id}`);
        return;
      }
      setClients(
        clientsData
          .map((c: { id: string; company: string; culturalDna?: CulturalDnaValue[]; leads?: { userId: string; name: string; email: string }[] }) => ({
            id: c.id,
            company: c.company,
            culturalDna: c.culturalDna ?? [],
            leads: c.leads ?? [],
          }))
          .sort((a: ClientOption, b: ClientOption) => a.company.localeCompare(b.company))
      );
      setSelectedClientId(sessionData.clientId);
      setTitle(sessionData.title);
      setDescription(sessionData.description ?? "");
      setShowBehaviors(!!sessionData.showBehaviors);
      setLoading(false);
    });
  }, [id, router]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );
  const clientDna = selectedClient?.culturalDna ?? [];
  const hasDna = clientDna.length >= 2;
  const hasAnyBehaviors = clientDna.some((v) => (v.behaviors?.length ?? 0) > 0);

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId);
    setError(null);
  }

  async function handleSave() {
    if (!selectedClientId) { setError("Select a client."); return; }
    if (!hasDna) { setError("Selected client needs at least 2 cultural DNA values."); return; }
    if (!title.trim()) { setError("Title is required."); return; }

    setSaving(true);
    setError(null);

    const res = await fetch(`/api/ranking-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClientId,
        title: title.trim(),
        description: description.trim() || null,
        showBehaviors: hasAnyBehaviors ? showBehaviors : false,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save session.");
      setSaving(false);
      return;
    }

    router.push(`/tools/ranking/${id}`);
  }

  if (loading) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        breadcrumbs={[
          { label: "Tools", href: "/tools" },
          { label: "Ranking the Values", href: "/tools/ranking" },
          { label: "Edit" },
        ]}
        title="Edit session"
      />

      <div className="px-7 pb-7 pt-5 max-w-2xl">
        <div className="mb-5">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Client *</label>
          <ClientDropdown
            clients={clients}
            selectedClientId={selectedClientId}
            onSelect={handleClientSelect}
            loading={false}
          />
        </div>

        {selectedClient && (
          hasDna ? (
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
          ) : (
            <div className="mb-5 p-4 rounded-card border text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
              {selectedClient.company} does not have cultural DNA yet. Set it up on the client before switching to it here.
            </div>
          )
        )}

        <div className="mb-4">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="mb-5">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-button border text-sm resize-none"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          />
        </div>

        {hasAnyBehaviors && (
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

        <div className="flex gap-2">
          <button onClick={() => router.push(`/tools/ranking/${id}`)} className="btn-ghost rounded-lg text-sm px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasDna}
            className="btn-primary rounded-lg text-sm px-5 py-2"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
