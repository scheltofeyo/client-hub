"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import type { PermissionGroup, Permission } from "@/lib/permissions";
import { PERMISSION_DEPENDENCIES, getDependencyChain, getDependents } from "@/lib/permissions";

interface RoleData {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

export default function RoleDetailEditor({ role }: { role: RoleData }) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [permissions, setPermissions] = useState<Set<string>>(new Set(role.permissions));
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/permissions")
      .then((r) => (r.ok ? r.json() : { global: [] }))
      .then((data: { global: PermissionGroup[] }) => setGroups(data.global))
      .catch(() => {});
  }, []);

  const dirty =
    name !== role.name ||
    description !== role.description ||
    !setsEqual(permissions, new Set(role.permissions));

  const isMissingDependency = useCallback((key: Permission): boolean => {
    const dep = PERMISSION_DEPENDENCIES[key];
    return !!dep && !permissions.has(dep);
  }, [permissions]);

  const togglePermission = useCallback((key: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        for (const dep of getDependents(key as Permission)) next.delete(dep);
      } else {
        next.add(key);
        for (const dep of getDependencyChain(key as Permission)) next.add(dep);
      }
      return next;
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          permissions: Array.from(permissions),
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin?tab=roles");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to delete");
      }
    } catch {
      setError("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin?tab=roles")}
          className="btn-ghost p-1.5 rounded-lg"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {role.name}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Slug: {role.slug}
            {role.isSystem && " · System role"}
          </p>
        </div>
        {!role.isSystem && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            {deleting ? "Deleting\u2026" : "Delete"}
          </button>
        )}
      </div>

      {/* Name & description */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="typo-label">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={role.isSystem}
              className="w-full text-sm px-3 py-2 rounded-lg disabled:opacity-60"
              style={{
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <label className="typo-label">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg"
              style={{
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Permissions */}
      <PermissionSection
        title="Permissions"
        description="What users with this role can do across the application."
        groups={groups}
        selected={permissions}
        onToggle={togglePermission}
        isMissingDependency={isMissingDependency}
        showDependencyHints
      />

      {/* Save bar */}
      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving\u2026" : "Save Changes"}
        </button>
        {saved && (
          <span className="text-sm" style={{ color: "var(--success)" }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shared permission list component ─────────────────────────────────

function PermissionSection({
  title,
  description,
  groups,
  selected,
  onToggle,
  isMissingDependency,
  showDependencyHints,
}: {
  title: string;
  description: string;
  groups: PermissionGroup[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onToggleGroup?: (group: PermissionGroup) => void;
  isMissingDependency?: (key: Permission) => boolean;
  showDependencyHints?: boolean;
}) {
  return (
    <div>
      <h2 className="typo-card-title mb-1" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="typo-section-header mb-0.5" style={{ color: "var(--text-primary)" }}>
              {group.label}
            </h3>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              {group.description}
            </p>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {group.permissions.map((p, i) => {
                const disabled = !!(showDependencyHints && isMissingDependency?.(p.key));
                const groupKeys = new Set(group.permissions.map((gp) => gp.key));
                let depth = 0;
                let cur: Permission | undefined = PERMISSION_DEPENDENCIES[p.key];
                while (cur && groupKeys.has(cur)) {
                  depth++;
                  cur = PERMISSION_DEPENDENCIES[cur];
                }
                return (
                  <div
                    key={p.key}
                    className="flex items-center justify-between py-2.5"
                    style={{
                      background: "var(--bg-surface)",
                      borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                      opacity: disabled ? 0.4 : 1,
                      paddingLeft: `${16 + depth * 20}px`,
                      paddingRight: "16px",
                    }}
                  >
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {p.label}
                    </span>
                    <Toggle
                      checked={selected.has(p.key)}
                      onChange={() => onToggle(p.key)}
                      disabled={disabled}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
