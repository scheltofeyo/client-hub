"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ProjectRole, RoleAllocationLine } from "@/types";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { formatEuro, lineTotal } from "./money";

/**
 * Consolidated role-allocation editor. Replaces the near-identical
 * `RoleAllocationEditor` (plan) and `TemplateBudgetEditor` (admin templates).
 *
 * The project surface shows an "Assigned" column (which user does this role);
 * the template surface omits it. Toggle via `showAssignedColumn`.
 */
export default function BudgetEditor({
  pricingMode,
  allocation,
  projectRoles,
  readonly = false,
  showAssignedColumn = false,
  assignableUsers = [],
  onChange,
}: {
  pricingMode: "manual" | "rolebased";
  allocation: RoleAllocationLine[];
  projectRoles: ProjectRole[];
  readonly?: boolean;
  showAssignedColumn?: boolean;
  assignableUsers?: { id: string; name: string; image: string | null }[];
  onChange: (allocation: RoleAllocationLine[], pricingMode: "manual" | "rolebased") => void;
}) {
  const gridCols = showAssignedColumn ? "1fr 70px 1fr 110px 32px" : "1fr 90px 130px 32px";

  function addLine() {
    if (projectRoles.length === 0) return;
    const role = projectRoles[0];
    onChange(
      [
        ...allocation,
        {
          roleId: role.id,
          roleName: role.name,
          days: 0,
          dayRate: role.dayRate,
          marginMultiplier: role.marginMultiplier,
          isExternal: role.isExternal,
          externalCostRate: role.isExternal ? role.externalCostRate : undefined,
        },
      ],
      pricingMode
    );
  }

  function updateLine(i: number, patch: Partial<RoleAllocationLine>) {
    onChange(
      allocation.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
      pricingMode
    );
  }

  function changeRole(i: number, roleId: string) {
    const role = projectRoles.find((r) => r.id === roleId);
    if (!role) return;
    updateLine(i, {
      roleId,
      roleName: role.name,
      dayRate: role.dayRate,
      marginMultiplier: role.marginMultiplier,
      isExternal: role.isExternal,
      externalCostRate: role.isExternal ? role.externalCostRate : undefined,
    });
  }

  function removeLine(i: number) {
    onChange(
      allocation.filter((_, idx) => idx !== i),
      pricingMode
    );
  }

  function assignUser(i: number, userId: string) {
    if (!userId) {
      updateLine(i, { assignedUser: undefined });
      return;
    }
    const u = assignableUsers.find((x) => x.id === userId);
    if (!u) return;
    updateLine(i, { assignedUser: { userId: u.id, name: u.name, image: u.image ?? undefined } });
  }

  const total = allocation.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div
          className="inline-flex rounded-md border p-0.5"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          role="tablist"
          aria-label="Pricing mode"
        >
          {(["rolebased", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={pricingMode === m}
              disabled={readonly}
              onClick={() => onChange(allocation, m)}
              className="px-2 py-1 text-xs font-medium rounded-sm transition-colors disabled:opacity-50"
              style={{
                background: pricingMode === m ? "var(--bg-surface)" : "transparent",
                color: pricingMode === m ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {m === "manual" ? "Fixed" : "Role-based"}
            </button>
          ))}
        </div>
        {pricingMode === "rolebased" && (
          <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
            {formatEuro(total)}
          </span>
        )}
      </div>

      {pricingMode === "rolebased" && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="grid items-center px-3 py-2 typo-section-header"
            style={{
              gridTemplateColumns: gridCols,
              gap: 8,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
            }}
          >
            <span>Role</span>
            <span>Days</span>
            {showAssignedColumn && <span>Assigned</span>}
            <span className="text-right">Total</span>
            <span />
          </div>
          {allocation.map((line, i) => (
            <div
              key={i}
              className="grid items-center px-3 py-2 text-sm"
              style={{
                gridTemplateColumns: gridCols,
                gap: 8,
                borderBottom: i < allocation.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <select
                value={line.roleId}
                disabled={readonly}
                onChange={(e) => changeRole(i, e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                {projectRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.isExternal ? " (ext)" : ""}
                  </option>
                ))}
                {projectRoles.findIndex((r) => r.id === line.roleId) === -1 && (
                  <option value={line.roleId}>{line.roleName} (removed)</option>
                )}
              </select>
              <input
                type="number"
                min={0}
                step={0.5}
                value={line.days}
                disabled={readonly}
                onChange={(e) => updateLine(i, { days: Number(e.target.value) })}
                className={inputClass}
                style={{ ...inputStyle, textAlign: "right" }}
              />
              {showAssignedColumn && (
                <select
                  value={line.assignedUser?.userId ?? ""}
                  disabled={readonly}
                  onChange={(e) => assignUser(i, e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">— unassigned —</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatEuro(lineTotal(line))}
              </span>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={readonly}
                className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)] disabled:opacity-30"
                title="Remove line"
                aria-label="Remove role line"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {allocation.length === 0 && (
            <div className="px-3 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No role lines yet.
            </div>
          )}
        </div>
      )}

      {pricingMode === "rolebased" && !readonly && (
        <button
          type="button"
          onClick={addLine}
          disabled={projectRoles.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-tertiary disabled:opacity-50"
        >
          <Plus size={12} />
          Add role line
        </button>
      )}
      {pricingMode === "rolebased" && projectRoles.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No project roles defined yet — set them up in admin → Labels and Types → Project Roles.
        </p>
      )}
      {pricingMode === "rolebased" && projectRoles.length > 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Day rate, multiplier and pay-out are snapshotted when a line is added. Later edits in admin
          do not change existing plans or templates.
        </p>
      )}
    </div>
  );
}
