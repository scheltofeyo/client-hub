"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import UserAvatar from "@/components/ui/UserAvatar";
import DataTable, { type ColumnDef, type SortState } from "@/components/ui/DataTable";
import { fmtDate } from "@/lib/utils";
import type { Client, ClientLead, ClientStatusOption } from "@/types";
import type { FirstEventResult } from "@/lib/data";

export type OverviewRow = {
  client: Client;
  openTasks: number;
  openProjects: number;
  lastActivityAt: string | null;
  firstEvent: FirstEventResult;
};

// ── Client avatar helpers ──────────────────────────────────────────────────

const ACCENT_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#D97706",
  "#DC2626", "#DB2777", "#0891B2", "#0D9488",
];

function accentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function initials(company: string): string {
  return company.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ── Check-in timer helpers ─────────────────────────────────────────────────

const DEFAULT_CHECK_IN_WINDOW = 60;

function daysSinceISO(isoString: string): number {
  const past = new Date(isoString);
  const now = new Date();
  return Math.floor((now.getTime() - past.getTime()) / 86400000);
}

function checkinColor(daysRemaining: number, window: number): string {
  if (daysRemaining > window * 0.5) return "color-mix(in srgb, var(--primary) 75%, transparent)";
  if (daysRemaining > window * 0.25) return "#d97706bf";
  if (daysRemaining > window * 0.08) return "#ea580cbf";
  return "#dc2626bf";
}

// ── Sort types ─────────────────────────────────────────────────────────────

type SortCol = "client" | "status" | "projects" | "checkin" | "event";

// ── CheckinCell ────────────────────────────────────────────────────────────

function CheckinCell({ lastActivityAt, window }: { lastActivityAt: string | null; window: number }) {
  const daysElapsed = lastActivityAt ? daysSinceISO(lastActivityAt) : window;
  const daysRemaining = window - daysElapsed;
  const isOverdue = daysRemaining < 0;
  const fillPct = Math.max(0, Math.min(100, (daysRemaining / window) * 100));
  const color = checkinColor(daysRemaining, window);
  const label = isOverdue
    ? `${Math.abs(daysRemaining)}d overdue`
    : daysRemaining === 0
    ? "Due today"
    : `${daysRemaining}d left`;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-1 rounded-full overflow-hidden w-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${fillPct}%`, background: color }}
        />
      </div>
      <span className="text-xs" style={{ color: isOverdue ? color : "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

// ── FilterBar ──────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearch,
  statuses,
  selectedStatuses,
  onToggleStatus,
  leads,
  selectedLeads,
  onToggleLead,
  hasFilters,
  onClear,
}: {
  search: string;
  onSearch: (v: string) => void;
  statuses: string[];
  selectedStatuses: Set<string>;
  onToggleStatus: (s: string) => void;
  leads: ClientLead[];
  selectedLeads: Set<string>;
  onToggleLead: (id: string) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-8 pr-3 py-1.5 text-sm rounded-lg border outline-none transition-colors"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            width: 180,
          }}
        />
      </div>

      {/* Status chips */}
      {statuses.length > 0 && (
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Status</span>
          {statuses.map((s) => {
            const active = selectedStatuses.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggleStatus(s)}
                className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize"
                style={active
                  ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" }
                  : { background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-secondary)" }
                }
              >
                {s.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      )}

      {/* Lead chips */}
      {leads.length > 0 && (
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Lead</span>
          {leads.map((lead) => {
            const active = selectedLeads.has(lead.userId);
            return (
              <button
                key={lead.userId}
                type="button"
                onClick={() => onToggleLead(lead.userId)}
                className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors"
                style={active
                  ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" }
                  : { background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-secondary)" }
                }
              >
                {lead.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-xs btn-ghost px-2 py-1 rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
}

// ── ClientsOverviewTable ───────────────────────────────────────────────────

export default function ClientsOverviewTable({ rows, statusOptions = [] }: { rows: OverviewRow[]; statusOptions?: ClientStatusOption[] }) {
  const statusWindowMap = useMemo(() => {
    const m = new Map<string, number>();
    statusOptions.forEach((s) => { if (s.checkInDays != null) m.set(s.slug, s.checkInDays); });
    return m;
  }, [statusOptions]);

  const [sort, setSort] = useState<SortState>({ col: "client", dir: "asc" });
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const allStatuses = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { if (r.client.status) seen.add(r.client.status); });
    return [...seen].sort();
  }, [rows]);

  const allLeads = useMemo(() => {
    const map = new Map<string, ClientLead>();
    rows.forEach((r) => r.client.leads?.forEach((l) => { if (!map.has(l.userId)) map.set(l.userId, l); }));
    return [...map.values()];
  }, [rows]);

  const hasFilters = search.trim() !== "" || selectedStatuses.size > 0 || selectedLeads.size > 0;

  function toggle<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    return next;
  }

  function handleSort(col: string) {
    setSort((prev) =>
      prev.col === col
        ? prev.dir === "asc" ? { col, dir: "desc" } : { col: null, dir: "asc" }
        : { col, dir: "asc" }
    );
  }

  const getWindow = (row: OverviewRow) =>
    (row.client.status ? statusWindowMap.get(row.client.status) : undefined) ?? DEFAULT_CHECK_IN_WINDOW;

  const urgencyScore = (row: OverviewRow) => {
    const window = getWindow(row);
    const daysElapsed = row.lastActivityAt ? daysSinceISO(row.lastActivityAt) : window;
    return window - daysElapsed;
  };

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (search.trim() && !row.client.company.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(row.client.status ?? "")) return false;
      if (selectedLeads.size > 0 && !row.client.leads?.some((l) => selectedLeads.has(l.userId))) return false;
      return true;
    });
  }, [rows, search, selectedStatuses, selectedLeads]);

  const sorted = useMemo(() => {
    if (sort.col === null) {
      return [...filtered].sort((a, b) => {
        const sa = urgencyScore(a);
        const sb = urgencyScore(b);
        if (sa !== sb) return sa - sb;
        return b.openTasks - a.openTasks;
      });
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sort.col as SortCol) {
        case "client":  cmp = a.client.company.localeCompare(b.client.company); break;
        case "status":  cmp = (a.client.status ?? "").localeCompare(b.client.status ?? ""); break;
        case "projects": cmp = a.openProjects - b.openProjects; break;
        case "checkin": cmp = urgencyScore(a) - urgencyScore(b); break;
        case "event":   cmp = (a.firstEvent?.date ?? "9999") < (b.firstEvent?.date ?? "9999") ? -1 : 1; break;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnDef<OverviewRow>[] = [
    {
      key: "client",
      label: "Client",
      minWidth: 200,
      sortable: true,
      sticky: true,
      render: (row) => (
        <Link
          href={`/clients/${row.client.id}`}
          className="flex items-center gap-2.5 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="inline-flex items-center justify-center rounded-lg shrink-0 text-white text-xs font-bold"
            style={{ width: 28, height: 28, background: accentColor(row.client.company) }}
          >
            {initials(row.client.company)}
          </span>
          <span
            className="font-medium group-hover:underline truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {row.client.company}
          </span>
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      minWidth: 110,
      sortable: true,
      render: (row) =>
        row.client.status ? (
          <StatusBadge status={row.client.status} />
        ) : (
          <span style={{ color: "var(--text-muted)" }}>–</span>
        ),
    },
    {
      key: "leads",
      label: "Leads",
      minWidth: 90,
      render: (row) =>
        row.client.leads && row.client.leads.length > 0 ? (
          <div className="flex items-center" style={{ isolation: "isolate" }}>
            {row.client.leads.map((lead, i) => (
              <span key={lead.userId} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: i, position: "relative" }}>
                <UserAvatar name={lead.name} image={lead.image} size={24} />
              </span>
            ))}
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>–</span>
        ),
    },
    {
      key: "projects",
      label: "Projects",
      minWidth: 130,
      sortable: true,
      render: (row) =>
        row.openProjects > 0 || row.openTasks > 0 ? (
          <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
            {row.openProjects > 0 ? row.openProjects : "–"}
            {row.openTasks > 0 && (
              <span style={{ color: "var(--text-muted)" }}> ({row.openTasks} tasks)</span>
            )}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>–</span>
        ),
    },
    {
      key: "checkin",
      label: "Check-in",
      minWidth: 160,
      sortable: true,
      render: (row) => <CheckinCell lastActivityAt={row.lastActivityAt} window={getWindow(row)} />,
    },
    {
      key: "event",
      label: "Next event",
      minWidth: 180,
      sortable: true,
      render: (row) =>
        row.firstEvent ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
              {row.firstEvent.title}
            </span>
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              {fmtDate(row.firstEvent.date)}
            </span>
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>–</span>
        ),
    },
  ];

  return (
    <DataTable<OverviewRow>
      columns={columns}
      rows={sorted}
      getRowKey={(row) => row.client.id}
      sort={sort}
      onSort={handleSort}
      onRowClick={(row) => { window.location.href = `/clients/${row.client.id}`; }}
      filterBar={
        <FilterBar
          search={search}
          onSearch={setSearch}
          statuses={allStatuses}
          selectedStatuses={selectedStatuses}
          onToggleStatus={(s) => setSelectedStatuses(toggle(selectedStatuses, s))}
          leads={allLeads}
          selectedLeads={selectedLeads}
          onToggleLead={(id) => setSelectedLeads(toggle(selectedLeads, id))}
          hasFilters={hasFilters}
          onClear={() => { setSearch(""); setSelectedStatuses(new Set()); setSelectedLeads(new Set()); }}
        />
      }
      emptyMessage={hasFilters ? "No clients match these filters" : "No clients yet"}
    />
  );
}
