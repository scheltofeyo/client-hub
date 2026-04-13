"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, Lock } from "lucide-react";

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  rank: number;
  userCount: number;
}

export default function AdminRolesTable({ initialRoles }: { initialRoles: Role[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          permissions: [],
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setRoles((prev) => [...prev, created]);
        setNewName("");
        setNewDescription("");
        setShowCreate(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create role");
      }
    } catch {
      setError("Failed to create role");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Plus size={16} />
          New Role
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl p-4 space-y-3"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="typo-label">
                Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Manager"
                required
                className="w-full text-sm px-3 py-2 rounded-lg"
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
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description"
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(""); }}
              className="btn-ghost text-sm px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn-primary text-sm px-3 py-1.5 rounded-lg"
            >
              {creating ? "Creating\u2026" : "Create Role"}
            </button>
          </div>
        </form>
      )}

      {/* Role list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {roles.map((role, i) => (
          <div
            key={role.id}
            onClick={() => router.push(`/admin/roles/${role.id}`)}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover-row"
            style={{
              borderBottom: i < roles.length - 1 ? "1px solid var(--border)" : undefined,
            }}
          >
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: role.isSystem ? "var(--primary-light)" : "var(--bg-hover)",
                color: role.isSystem ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              {role.isSystem ? <Lock size={14} /> : <Shield size={14} />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {role.name}
                {role.isSystem && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    System
                  </span>
                )}
              </p>
              {role.description && (
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {role.description}
                </p>
              )}
            </div>

            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
            >
              {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
            </span>

            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
            >
              {role.userCount} user{role.userCount !== 1 ? "s" : ""}
            </span>
          </div>
        ))}

        {roles.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No roles defined yet.
          </div>
        )}
      </div>
    </div>
  );
}
