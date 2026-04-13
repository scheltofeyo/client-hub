"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { ClientStatusOption, ClientPlatformOption } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function AddClientForm({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    company: "",
    status: "",
    platform: "",
    clientSince: today,
    employees: "",
    website: "",
    description: "",
    createFolder: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusOptions, setStatusOptions] = useState<ClientStatusOption[]>([]);
  const [platformOptions, setPlatformOptions] = useState<ClientPlatformOption[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/client-statuses").then((r) => r.json()).then(setStatusOptions).catch(() => {});
    fetch("/api/client-platforms").then((r) => r.json()).then(setPlatformOptions).catch(() => {});
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;

    setLoading(true);
    setError("");

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        employees: form.employees ? Number(form.employees) : undefined,
        createFolder: form.createFolder,
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
        <label htmlFor="ac-company" className="typo-label">
          Company name <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          id="ac-company"
          type="text"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
          placeholder="Acme Corp"
          autoFocus
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="ac-description" className="typo-label">
          Description
        </label>
        <textarea
          id="ac-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What does this client do?"
          rows={3}
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ac-website" className="typo-label">
            Website
          </label>
          <input
            id="ac-website"
            type="text"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="acme.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="ac-client-since" className="typo-label">
            Client since
          </label>
          <input
            id="ac-client-since"
            type="date"
            value={form.clientSince}
            onChange={(e) => set("clientSince", e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label htmlFor="ac-employees" className="typo-label">
          Employees
        </label>
        <input
          id="ac-employees"
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
          <label htmlFor="ac-status" className="typo-label">
            Status
          </label>
          <select
            id="ac-status"
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
          <label htmlFor="ac-platform" className="typo-label">
            Platform
          </label>
          <select
            id="ac-platform"
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

      <div
        className="rounded-xl px-3 py-2.5"
        style={{ background: "var(--primary-light, #ede9fe)" }}
      >
        <label className="flex items-center justify-between cursor-pointer select-none">
          <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>
            Create Google Drive folder
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.createFolder}
            onClick={() => setForm((f) => ({ ...f, createFolder: !f.createFolder }))}
            className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
            style={{
              background: form.createFolder ? "var(--primary)" : "var(--border)",
            }}
          >
            <span
              className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: form.createFolder ? "translateX(18px)" : "translateX(2px)" }}
            />
          </button>
        </label>
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
          {loading ? "Saving…" : "Add Client"}
        </button>
      </div>
    </form>
  );
}

export default function AddClientButton() {
  const { openPanel, closePanel } = useRightPanel();

  function handleOpen() {
    openPanel("Add Client", <AddClientForm onClose={closePanel} />);
  }

  return (
    <button
      onClick={handleOpen}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
    >
      <Plus size={14} />
      Add Client
    </button>
  );
}
