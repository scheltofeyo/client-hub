"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type StatusFilter = "active" | "invited" | "inactive";

interface RoleOption {
  slug: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  status: string;
  firstName?: string;
  preposition?: string;
  lastName?: string;
  employeeNumber?: string;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function statusColor(status: string) {
  switch (status) {
    case "active": return { bg: "var(--success-light)", color: "var(--success)" };
    case "invited": return { bg: "var(--warning-light)", color: "var(--warning)" };
    case "inactive": return { bg: "var(--bg-hover)", color: "var(--text-muted)" };
    default: return { bg: "var(--bg-hover)", color: "var(--text-muted)" };
  }
}

function roleBadge(role: string) {
  if (role === "admin") return { bg: "var(--primary-light)", color: "var(--primary)" };
  if (role !== "member") return { bg: "var(--bg-hover)", color: "var(--text-secondary)" };
  return null;
}

export default function AdminEmployeesTable({
  employees,
  currentUserId,
}: {
  employees: Employee[];
  currentUserId: string;
}) {
  const [rows, setRows] = useState(employees);
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(
    new Set(["active", "invited"])
  );
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ slug: string; name: string }>) =>
        setRoleOptions(data.map((r) => ({ slug: r.slug, name: r.name })))
      )
      .catch(() => {});
  }, []);

  const filteredRows = useMemo(() => {
    if (statusFilters.size === 0) return rows;
    return rows.filter((emp) => statusFilters.has((emp.status || "active") as StatusFilter));
  }, [rows, statusFilters]);

  function toggleFilter(status: StatusFilter) {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  const hasArchived = rows.some((emp) => emp.status === "inactive");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          firstName: inviteFirstName.trim() || undefined,
          lastName: inviteLastName.trim() || undefined,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setRows((prev) => [...prev, {
          ...created,
          image: null,
        }]);
        setInviteEmail("");
        setInviteFirstName("");
        setInviteLastName("");
        setInviteRole("member");
        setShowInvite(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setInviteError(data?.error ?? "Failed to invite employee");
      }
    } catch {
      setInviteError("Failed to invite employee");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters and invite */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {(["active", "invited", ...(hasArchived ? ["inactive" as const] : [])] as StatusFilter[]).map((s) => {
            const active = statusFilters.has(s);
            const sc = statusColor(s);
            const label = s === "inactive" ? "archived" : s;
            return (
              <button
                key={s}
                onClick={() => toggleFilter(s)}
                className="text-xs font-medium px-2.5 py-1 rounded-full capitalize transition-opacity"
                style={{
                  background: active ? sc.bg : "var(--bg-hover)",
                  color: active ? sc.color : "var(--text-muted)",
                  opacity: active ? 1 : 0.6,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="btn-primary text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Plus size={16} />
          Invite Employee
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="rounded-xl p-4 space-y-3"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="typo-label">
                Email *
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="employee@company.com"
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
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              >
                {roleOptions.length > 0
                  ? roleOptions.map((r) => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))
                  : <>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </>
                }
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="typo-label">
                First name
              </label>
              <input
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                placeholder="First name"
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
                Last name
              </label>
              <input
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                placeholder="Last name"
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {inviteError && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{inviteError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowInvite(false); setInviteError(""); }}
              className="btn-ghost text-sm px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="btn-primary text-sm px-3 py-1.5 rounded-lg"
            >
              {inviting ? "Inviting\u2026" : "Send Invite"}
            </button>
          </div>
        </form>
      )}

      {/* Employee list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {filteredRows.map((emp, i) => {
          const sc = statusColor(emp.status);
          const rb = roleBadge(emp.role);

          return (
            <div
              key={emp.id}
              onClick={() => router.push(`/admin/employees/${emp.id}`)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover-row"
              style={{
                borderBottom: i < filteredRows.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              {/* Avatar */}
              <div
                className="shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
                style={{
                  background: emp.status === "invited" ? "var(--border)" : "var(--primary)",
                  opacity: emp.status === "inactive" ? 0.5 : 1,
                }}
              >
                {emp.image ? (
                  <Image src={emp.image} alt={emp.name} width={32} height={32} className="object-cover" />
                ) : (
                  initials(emp.name)
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{
                    color: emp.status === "inactive" ? "var(--text-muted)" : "var(--text-primary)",
                  }}
                >
                  {emp.name}
                  {emp.id === currentUserId && (
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                      (you)
                    </span>
                  )}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {emp.email}
                </p>
              </div>

              {/* Status badge */}
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                style={{ background: sc.bg, color: sc.color }}
              >
                {emp.status === "inactive" ? "archived" : (emp.status || "active")}
              </span>

              {/* Role badge */}
              {rb && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                  style={{ background: rb.bg, color: rb.color }}
                >
                  {emp.role}
                </span>
              )}
            </div>
          );
        })}

        {filteredRows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {rows.length === 0
              ? "No employees yet. Invite your first employee above."
              : "No employees match the selected filters."}
          </div>
        )}
      </div>
    </div>
  );
}
