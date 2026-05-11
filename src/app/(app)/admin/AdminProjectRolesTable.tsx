"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import DataTable, { type ColumnDef, type SortState } from "@/components/ui/DataTable";
import type { ProjectRole } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function RoleForm({
  initial,
  onSaved,
  onClose,
}: {
  initial?: ProjectRole;
  onSaved: (r: ProjectRole) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [dayRate, setDayRate] = useState(initial?.dayRate != null ? String(initial.dayRate) : "");
  const [marginMultiplier, setMarginMultiplier] = useState(
    initial?.marginMultiplier != null ? String(initial.marginMultiplier) : "1"
  );
  const [isExternal, setIsExternal] = useState(!!initial?.isExternal);
  const [externalCostRate, setExternalCostRate] = useState(
    initial?.externalCostRate != null ? String(initial.externalCostRate) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isEdit = !!initial;

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const payload = {
      name,
      dayRate: dayRate.trim() === "" ? 0 : Number(dayRate),
      marginMultiplier: marginMultiplier.trim() === "" ? 1 : Number(marginMultiplier),
      isExternal,
      externalCostRate: isExternal && externalCostRate.trim() !== "" ? Number(externalCostRate) : null,
    };
    const url = isEdit ? `/api/project-roles/${initial!.id}` : "/api/project-roles";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({ error: "Failed to save" }));
      setError(d.error ?? "Failed to save");
      return;
    }
    const saved: ProjectRole = await res.json();
    onSaved(saved);
    router.refresh();
    onClose();
  }

  const effectiveRate = (Number(dayRate) || 0) * (Number(marginMultiplier) || 1);

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div>
        <label className="typo-label">
          Name <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. Sr consultant"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="typo-label">Day rate (EUR)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={dayRate}
            onChange={(e) => setDayRate(e.target.value)}
            placeholder="e.g. 900"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="typo-label">Margin multiplier</label>
          <input
            type="number"
            min={0}
            step={0.05}
            value={marginMultiplier}
            onChange={(e) => setMarginMultiplier(e.target.value)}
            placeholder="1.0"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Effective day rate: <span className="tabular-nums">{formatEuro(effectiveRate)}</span>
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isExternal}
          onChange={(e) => setIsExternal(e.target.checked)}
          className="w-4 h-4"
        />
        <span style={{ color: "var(--text-primary)" }}>External role (higher margin)</span>
      </label>
      {isExternal && (
        <div>
          <label className="typo-label">External cost rate (EUR / day)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={externalCostRate}
            onChange={(e) => setExternalCostRate(e.target.value)}
            placeholder="What we pay out per day"
            className={inputClass}
            style={inputStyle}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Internal-only — used to track pay-out to externals and actual revenue per project. Not shown to clients.
          </p>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save role"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm btn-ghost"
        >
          <X size={13} />
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminProjectRolesTable({
  initialRoles,
}: {
  initialRoles: ProjectRole[];
}) {
  const [roles, setRoles] = useState<ProjectRole[]>(initialRoles);
  const [sort, setSort] = useState<SortState>({ col: "rank", dir: "asc" });
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openCreatePanel() {
    openPanel(
      "New project role",
      <RoleForm
        onSaved={(r) => setRoles((prev) => [...prev, r])}
        onClose={closePanel}
      />
    );
  }

  function openEditPanel(role: ProjectRole) {
    openPanel(
      "Edit project role",
      <RoleForm
        initial={role}
        onSaved={(r) => setRoles((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...r } : x)))}
        onClose={closePanel}
      />
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const ordered = [...roles].sort((a, b) => a.rank - b.rank);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    const withRanks = ordered.map((r, i) => ({ ...r, rank: i }));
    setRoles(withRanks);
    await fetch("/api/project-roles/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ordered.map((r) => r.id) }),
    });
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete role "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/project-roles/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRoles((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  const sortedRows = useMemo(() => {
    const arr = [...roles];
    const { col, dir } = sort;
    if (!col) return arr.sort((a, b) => a.rank - b.rank);
    arr.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (col) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "isExternal":
          av = a.isExternal ? 1 : 0;
          bv = b.isExternal ? 1 : 0;
          break;
        case "dayRate":
          av = a.dayRate;
          bv = b.dayRate;
          break;
        case "marginMultiplier":
          av = a.marginMultiplier;
          bv = b.marginMultiplier;
          break;
        case "effectiveDayRate":
          av = a.dayRate * a.marginMultiplier;
          bv = b.dayRate * b.marginMultiplier;
          break;
        case "externalCostRate":
          av = a.externalCostRate ?? -1;
          bv = b.externalCostRate ?? -1;
          break;
        case "rank":
          av = a.rank;
          bv = b.rank;
          break;
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [roles, sort]);

  const rankSorted = useMemo(() => [...roles].sort((a, b) => a.rank - b.rank), [roles]);

  function indexOfInRankOrder(id: string) {
    return rankSorted.findIndex((r) => r.id === id);
  }

  const columns: ColumnDef<ProjectRole>[] = [
    {
      key: "name",
      label: "Name",
      minWidth: 180,
      sortable: true,
      sticky: true,
      render: (r) => (
        <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
          {r.name}
        </span>
      ),
    },
    {
      key: "isExternal",
      label: "Type",
      minWidth: 100,
      sortable: true,
      render: (r) =>
        r.isExternal ? (
          <span
            className="typo-tag inline-flex items-center px-2 py-0.5 rounded-badge"
            style={{ background: "var(--warning-light)", color: "var(--warning)" }}
          >
            External
          </span>
        ) : (
          <span className="typo-tag" style={{ color: "var(--text-muted)" }}>
            Internal
          </span>
        ),
    },
    {
      key: "dayRate",
      label: "Day rate",
      minWidth: 120,
      sortable: true,
      render: (r) => (
        <span className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatEuro(r.dayRate)}
        </span>
      ),
    },
    {
      key: "marginMultiplier",
      label: "Multiplier",
      minWidth: 100,
      sortable: true,
      render: (r) => (
        <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
          ×{r.marginMultiplier.toFixed(2)}
        </span>
      ),
    },
    {
      key: "effectiveDayRate",
      label: "Effective",
      minWidth: 130,
      sortable: true,
      render: (r) => (
        <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
          {formatEuro(r.dayRate * r.marginMultiplier)}
        </span>
      ),
    },
    {
      key: "externalCostRate",
      label: "Pay-out",
      minWidth: 110,
      sortable: true,
      render: (r) =>
        r.isExternal && r.externalCostRate != null ? (
          <span className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatEuro(r.externalCostRate)}
          </span>
        ) : (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
        ),
    },
    {
      key: "order",
      label: "Order",
      minWidth: 90,
      render: (r) => {
        const i = indexOfInRankOrder(r.id);
        return (
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(i, -1);
              }}
              disabled={i === 0}
              className="p-1.5 rounded-md btn-icon disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(i, 1);
              }}
              disabled={i === rankSorted.length - 1}
              className="p-1.5 rounded-md btn-icon disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      minWidth: 90,
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditPanel(r);
            }}
            className="p-1.5 rounded-md btn-icon"
            title="Edit role"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r.id, r.name);
            }}
            className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
            title="Delete role"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  function handleSort(col: string) {
    setSort((prev) => {
      if (prev.col === col) {
        return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { col, dir: "asc" };
    });
  }

  return (
    <div className="space-y-3">
      <DataTable<ProjectRole>
        columns={columns}
        rows={sortedRows}
        getRowKey={(r) => r.id}
        sort={sort}
        onSort={handleSort}
        emptyMessage="No project roles yet."
      />

      <button
        onClick={openCreatePanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New role
      </button>

      <div
        className="rounded-lg border px-4 py-3 text-xs leading-relaxed space-y-1"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-elevated)" }}
      >
        <p className="font-medium" style={{ color: "var(--text-secondary)" }}>How roles drive project pricing</p>
        <p>
          When a project uses role-based pricing, its <strong>soldPrice</strong> is calculated as the sum of{" "}
          <span className="tabular-nums">days × dayRate × marginMultiplier</span> across all role allocation lines.
          Rates are snapshotted on the project at the moment they are added — later edits to a role here do NOT
          change existing plans or projects.
        </p>
        <p>
          For <strong>external</strong> roles, the <strong>pay-out</strong> rate is what we actually owe the
          external per day. It powers the internal pay-out and actual-revenue totals per project / plan, and is
          never exposed to clients.
        </p>
      </div>
    </div>
  );
}
