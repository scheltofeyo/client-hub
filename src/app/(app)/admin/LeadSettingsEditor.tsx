"use client";

import { useState, useEffect, useCallback } from "react";
import Toggle from "@/components/ui/Toggle";
import type { PermissionGroup } from "@/lib/permissions";

export default function LeadSettingsEditor() {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/lead-settings").then((r) => (r.ok ? r.json() : { permissions: [] })),
      fetch("/api/permissions").then((r) => (r.ok ? r.json() : { lead: [] })),
    ]).then(([settings, permData]) => {
      const perms = new Set<string>(settings.permissions ?? []);
      setPermissions(perms);
      setOriginal(perms);
      setGroups(permData.lead ?? []);
      setLoaded(true);
    }).catch(() => {});
  }, []);

  const dirty = !setsEqual(permissions, original);

  const togglePermission = useCallback((key: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/lead-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: Array.from(permissions) }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = new Set<string>(data.permissions);
        setOriginal(updated);
        setPermissions(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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

  if (!loaded) return null;

  return (
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
            {group.permissions.map((p, i) => (
              <div
                key={p.key}
                className="flex items-center justify-between px-4 py-2.5"
                style={{
                  background: "var(--bg-surface)",
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {p.label}
                </span>
                <Toggle
                  checked={permissions.has(p.key)}
                  onChange={() => togglePermission(p.key)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

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
            Saved — changes take effect on next login
          </span>
        )}
      </div>
    </div>
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
