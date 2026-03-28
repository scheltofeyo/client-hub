"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { ProjectTemplate, Service } from "@/types";
import { useRouter } from "next/navigation";

export default function AdminTemplatesTable({
  initialTemplates,
  services,
}: {
  initialTemplates: ProjectTemplate[];
  services: Service[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const router = useRouter();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/project-templates/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {tpl.name}
              </p>
              {tpl.description && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {tpl.description}
                </p>
              )}
              <div className="flex gap-4 mt-1.5">
                {tpl.defaultSoldPrice != null && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Default price: €{tpl.defaultSoldPrice.toLocaleString()}
                  </span>
                )}
                {tpl.defaultServiceId && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Service: {services.find((s) => s.id === tpl.defaultServiceId)?.name ?? "—"}
                  </span>
                )}
                {tpl.defaultDescription && (
                  <span className="text-xs truncate max-w-xs" style={{ color: "var(--text-muted)" }}>
                    Default desc: {tpl.defaultDescription}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => router.push(`/admin/templates/${tpl.id}`)}
                className="p-1.5 rounded-md btn-icon"
                title="Edit template"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDelete(tpl.id, tpl.name)}
                className="p-1.5 rounded-md btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete template"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No templates yet.
        </p>
      )}

      <button
        onClick={() => router.push("/admin/templates/new")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New template
      </button>
    </div>
  );
}
