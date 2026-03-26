"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function AdminUsersTable({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [rows, setRows] = useState(users);
  const [saving, setSaving] = useState<string | null>(null);
  const router = useRouter();

  async function toggleAdmin(user: User) {
    setSaving(user.id);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: updated.isAdmin } : u)));
      router.refresh();
    }
    setSaving(null);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {rows.map((user, i) => (
        <div
          key={user.id}
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          {/* Avatar */}
          <div
            className="shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: "var(--primary)" }}
          >
            {user.image ? (
              <Image src={user.image} alt={user.name} width={32} height={32} className="object-cover" />
            ) : (
              initials(user.name)
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {user.name}
              {user.id === currentUserId && (
                <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                  (you)
                </span>
              )}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {user.email}
            </p>
          </div>

          {/* Admin badge */}
          {user.isAdmin && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "var(--primary-light)", color: "var(--primary)" }}
            >
              Admin
            </span>
          )}

          {/* Toggle — can't demote yourself */}
          <button
            onClick={() => toggleAdmin(user)}
            disabled={saving === user.id || user.id === currentUserId}
            className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 border transition-colors"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-sidebar)",
              color: "var(--text-primary)",
            }}
          >
            {saving === user.id
              ? "Saving…"
              : user.isAdmin
              ? "Remove admin"
              : "Make admin"}
          </button>
        </div>
      ))}
    </div>
  );
}
