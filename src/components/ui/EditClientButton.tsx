"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Client } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function EditClientForm({ client, onClose }: { client: Client; onClose: () => void }) {
  const [form, setForm] = useState({
    company: client.company ?? "",
    status: client.status ?? "",
    platform: client.platform ?? "",
    clientSince: client.clientSince ?? client.createdAt ?? "",
    employees: client.employees != null ? String(client.employees) : "",
    website: client.website ?? "",
    description: client.description ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ec-company" className={labelClass} style={labelStyle}>
          Company name <span className="text-red-400">*</span>
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
        <label htmlFor="ec-description" className={labelClass} style={labelStyle}>
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
          <label htmlFor="ec-website" className={labelClass} style={labelStyle}>
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
          <label htmlFor="ec-client-since" className={labelClass} style={labelStyle}>
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
        <label htmlFor="ec-employees" className={labelClass} style={labelStyle}>
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
          <label htmlFor="ec-status" className={labelClass} style={labelStyle}>
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="prospect">Prospect</option>
          </select>
        </div>
        <div>
          <label htmlFor="ec-platform" className={labelClass} style={labelStyle}>
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
            <option value="summ_core">SUMM Core</option>
            <option value="summ_suite">SUMM Suite</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

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
    </form>
  );
}

export default function EditClientButton({ client }: { client: Client }) {
  const { openPanel, closePanel } = useRightPanel();

  return (
    <button
      onClick={() =>
        openPanel("Edit Client", <EditClientForm client={client} onClose={closePanel} />)
      }
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
    >
      <Pencil size={13} />
      Edit
    </button>
  );
}
