"use client";

import { useEffect, useState } from "react";
import { ClientDropdown, type ClientOption } from "@/components/ranking/ClientDropdown";
import type { CulturalDnaValue } from "@/types";

export interface DuplicateSource {
  id: string;
  title: string;
  clientId: string;
}

/**
 * Copy a survey session into a new draft, optionally under another client.
 *
 * The client is a real choice rather than a fixed "same client" copy: the point of
 * duplicating is usually to run a survey you have shaped for one client with the
 * next one. The server re-materialises the Cultural DNA when the client changes —
 * this dialog only has to say so.
 */
export function DuplicateSessionModal({
  source,
  onClose,
  onDuplicated,
}: {
  source: DuplicateSource;
  onClose: () => void;
  onDuplicated: (newSessionId: string) => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientId, setClientId] = useState(source.clientId);
  const [title, setTitle] = useState(`${source.title} (copy)`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setClients(
          (list as {
            id: string;
            company: string;
            primaryColor?: string;
            culturalDna?: CulturalDnaValue[];
            leads?: { userId: string; name: string; email: string }[];
          }[])
            .map((c) => ({
              id: c.id,
              company: c.company,
              primaryColor: c.primaryColor,
              culturalDna: c.culturalDna ?? [],
              leads: c.leads ?? [],
            }))
            .sort((a, b) => a.company.localeCompare(b.company))
        );
        setLoadingClients(false);
      })
      .catch(() => {
        setClients([]);
        setLoadingClients(false);
      });
  }, []);

  async function handleDuplicate() {
    if (!title.trim()) {
      setError("Give the copy a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/surveys/sessions/${source.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, title: title.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not duplicate this survey.");
      setSaving(false);
      return;
    }
    const created = await res.json();
    onDuplicated(created.id);
  }

  const otherClient = clientId !== source.clientId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-card p-6 shadow-dropdown"
        style={{ background: "var(--bg-surface)" }}
      >
        <h2 className="typo-modal-title mb-1" style={{ color: "var(--text-primary)" }}>
          Duplicate survey
        </h2>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Creates a new draft with the same content. Submissions and the share link are not copied.
        </p>

        <div className="mb-4">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Client</label>
          <ClientDropdown
            clients={clients}
            selectedClientId={clientId}
            onSelect={setClientId}
            loading={loadingClients}
          />
          {otherClient && (
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              Cultural DNA values and levels are taken from the client you pick here.
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          />
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-button text-sm"
            style={{ background: "var(--danger-light)", color: "var(--danger)" }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost rounded-lg flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={handleDuplicate}
            disabled={saving}
            className="btn-primary rounded-lg flex-1 py-2.5 text-sm"
          >
            {saving ? "Duplicating..." : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}
