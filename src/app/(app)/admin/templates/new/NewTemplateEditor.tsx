"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Service } from "@/types";
import PageHeader from "@/components/layout/PageHeader";
import RichTextEditor from "@/components/ui/RichTextEditor";
import ServicePills from "@/components/ui/ServicePills";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export default function NewTemplateEditor({ services }: { services: Service[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    summary: "",
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
        summary: form.summary || undefined,
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
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div>
            <label className="typo-label">
              Template name <span className="text-[var(--danger)]">*</span>
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

          <ServicePills
            services={services}
            selectedId={form.defaultServiceId}
            onChange={(id) => set("defaultServiceId", id)}
            label="Service"
            required
          />

          <div>
            <label className="typo-label">
              Summary
            </label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Shown under the title when picking a template"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="typo-label">
              Default project description
            </label>
            <RichTextEditor
              content={form.defaultDescription}
              onChange={(html) => set("defaultDescription", html)}
              placeholder="Pre-fills the project description field…"
            />
          </div>

          <div className="!mt-9">
            <p className="typo-section-header mb-3" style={{ color: "var(--text-muted)" }}>
              Financial information
            </p>
            <label className="typo-label">
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
