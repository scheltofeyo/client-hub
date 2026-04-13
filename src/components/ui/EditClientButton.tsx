"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Archetype, Client, ClientStatusOption, ClientPlatformOption } from "@/types";


const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};


function EditClientForm({
  client,
  archetypes,
  isAdmin,
  canDelete = false,
  onClose,
}: {
  client: Client;
  archetypes: Archetype[];
  isAdmin: boolean;
  canDelete?: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    company: client.company ?? "",
    status: client.status ?? "",
    platform: client.platform ?? "",
    clientSince: client.clientSince ?? client.createdAt ?? "",
    employees: client.employees != null ? String(client.employees) : "",
    website: client.website ?? "",
    description: client.description ?? "",
    archetypeId: client.archetypeId ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusOptions, setStatusOptions] = useState<ClientStatusOption[]>([]);
  const [platformOptions, setPlatformOptions] = useState<ClientPlatformOption[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    fetch("/api/client-statuses").then((r) => r.json()).then(setStatusOptions).catch(() => {});
    fetch("/api/client-platforms").then((r) => r.json()).then(setPlatformOptions).catch(() => {});
  }, []);
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        employees: form.employees ? Number(form.employees) : undefined,
        archetypeId: form.archetypeId || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    onClose();
    router.refresh();
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError("");
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    if (!res.ok) {
      setDeleteError("Failed to delete client.");
      return;
    }
    onClose();
    router.push("/clients");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ec-company" className="typo-label">
          Company name <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          id="ec-company"
          type="text"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
          autoFocus
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="ec-description" className="typo-label">
          Description
        </label>
        <textarea
          id="ec-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ec-website" className="typo-label">
            Website
          </label>
          <input
            id="ec-website"
            type="text"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="acme.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="ec-client-since" className="typo-label">
            Client since
          </label>
          <input
            id="ec-client-since"
            type="date"
            value={form.clientSince}
            onChange={(e) => set("clientSince", e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label htmlFor="ec-employees" className="typo-label">
          Employees
        </label>
        <input
          id="ec-employees"
          type="number"
          min={1}
          value={form.employees}
          onChange={(e) => set("employees", e.target.value)}
          placeholder="e.g. 50"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ec-status" className="typo-label">
            Status
          </label>
          <select
            id="ec-status"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— None —</option>
            {statusOptions.map((s) => (
              <option key={s.id} value={s.slug}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ec-platform" className="typo-label">
            Platform
          </label>
          <select
            id="ec-platform"
            value={form.platform}
            onChange={(e) => set("platform", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Not on platform</option>
            {platformOptions.map((p) => (
              <option key={p.id} value={p.slug}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ec-archetype" className="typo-label">
          Archetype
        </label>
        <select
          id="ec-archetype"
          value={form.archetypeId}
          onChange={(e) => set("archetypeId", e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">— None —</option>
          {archetypes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !form.company.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {canDelete && (
        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          {!deleteConfirm ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="text-sm btn-link"
              style={{ color: "var(--destructive)" }}
            >
              Delete client…
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Are you sure you want to delete{" "}
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {client.company}
                </span>
                ? This cannot be undone.
              </p>
              {deleteError && <p className="text-xs text-[var(--danger)]">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-danger"
                >
                  {deleteLoading ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export default function EditClientButton({
  client,
  archetypes,
  isAdmin = false,
  canDelete = false,
}: {
  client: Client;
  archetypes: Archetype[];
  isAdmin?: boolean;
  canDelete?: boolean;
}) {
  const { openPanel, closePanel } = useRightPanel();

  return (
    <button
      onClick={() =>
        openPanel(
          "Edit Client",
          <EditClientForm client={client} archetypes={archetypes} isAdmin={isAdmin} canDelete={canDelete} onClose={closePanel} />
        )
      }
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
    >
      <Pencil size={13} />
      Edit
    </button>
  );
}
