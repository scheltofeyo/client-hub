"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Service } from "@/types";
import PageHeader from "@/components/layout/PageHeader";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

export default function NewTemplateEditor({ services }: { services: Service[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    defaultDescription: "",
    defaultSoldPrice: "",
    defaultServiceId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.defaultServiceId) {
      setError("Please select a service.");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/project-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        defaultDescription: form.defaultDescription || undefined,
        defaultSoldPrice: form.defaultSoldPrice ? Number(form.defaultSoldPrice) : undefined,
        defaultServiceId: form.defaultServiceId || undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create template");
      return;
    }

    const created = await res.json();
    router.push(`/admin/templates/${created.id}`);
  }

  const tertiaryNav = (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className="px-1 py-3 mr-5 text-sm font-medium border-b-2"
        style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
      >
        Settings
      </span>
    </div>
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Project Templates", href: "/admin?tab=templates" },
          { label: "..." },
        ]}
        title="New template"
        actions={
          <button
            type="submit"
            form="new-template-form"
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
          >
            <Check size={13} />
            {saving ? "Creating…" : "Create template"}
          </button>
        }
        tertiaryNav={tertiaryNav}
      />

      <div className="px-7 py-6 max-w-2xl">
        <form id="new-template-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div>
            <label className={labelClass} style={labelStyle}>
              Template name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
              placeholder="e.g. Website Project"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <p className={labelClass} style={labelStyle}>
              Service <span className="text-red-400">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => {
                const selected = form.defaultServiceId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => set("defaultServiceId", s.id)}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors"
                    style={
                      selected
                        ? {
                            background: "var(--primary)",
                            borderColor: "var(--primary)",
                            color: "#fff",
                          }
                        : {
                            background: "var(--bg-sidebar)",
                            borderColor: "var(--border)",
                            color: "var(--text-secondary)",
                          }
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Short description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Shown to users when picking a template"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Default project description
            </label>
            <textarea
              value={form.defaultDescription}
              onChange={(e) => set("defaultDescription", e.target.value)}
              rows={3}
              placeholder="Pre-fills the project description field…"
              className={inputClass + " resize-none"}
              style={inputStyle}
            />
          </div>

          <div className="!mt-9">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
              Financial information
            </p>
            <label className={labelClass} style={labelStyle}>
              Default sold price (€)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.defaultSoldPrice}
              onChange={(e) => set("defaultSoldPrice", e.target.value)}
              placeholder="e.g. 5000"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </form>
      </div>
    </>
  );
}
