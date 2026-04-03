"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ClientLead } from "@/types";
import UserAvatar from "@/components/ui/UserAvatar";

interface UserOption {
  id: string;
  name: string;
  email: string;
  image: string | null;
}


export default function LeadsSection({
  clientId,
  initialLeads,
  allUsers,
  isAdmin,
}: {
  clientId: string;
  initialLeads: ClientLead[];
  allUsers: UserOption[];
  isAdmin: boolean;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const assignedIds = new Set(leads.map((l) => l.userId));
  const available = allUsers.filter((u) => !assignedIds.has(u.id));

  async function patch(newLeads: ClientLead[]) {
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: newLeads }),
    });
    router.refresh();
  }

  async function handleAdd(user: UserOption) {
    setSaving(true);
    const newLead: ClientLead = { userId: user.id, name: user.name, email: user.email };
    const updated = [...leads, newLead];
    setLeads(updated);
    setPicking(false);
    await patch(updated);
    setSaving(false);
  }

  async function handleRemove(userId: string) {
    const updated = leads.filter((l) => l.userId !== userId);
    setLeads(updated);
    await patch(updated);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Client Leads
        </h2>
        {isAdmin && !picking && available.length > 0 && (
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1 text-xs font-medium btn-link"
          >
            <Plus size={12} />
            Assign lead
          </button>
        )}
      </div>

      {leads.length === 0 && !picking && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No leads assigned.
        </p>
      )}

      <div className="space-y-2">
        {leads.map((lead) => (
          <div
            key={lead.userId}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)" }}
          >
            {/* Avatar */}
            <UserAvatar
              name={lead.name}
              image={allUsers.find((u) => u.id === lead.userId)?.image}
              size={32}
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {lead.name}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {lead.email}
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleRemove(lead.userId)}
                className="shrink-0 p-1 rounded btn-icon"
                title="Remove lead"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* User picker */}
      {picking && (
        <div
          className="mt-3 rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="px-3 py-2 flex items-center justify-between border-b text-xs font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Select an employee
            <button onClick={() => setPicking(false)} className="btn-icon p-0.5 rounded">
              <X size={13} />
            </button>
          </div>
          {available.map((user) => (
            <button
              key={user.id}
              onClick={() => handleAdd(user)}
              disabled={saving}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <UserAvatar name={user.name} image={user.image} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {user.email}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
