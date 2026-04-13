"use client";

import { useState, useMemo } from "react";
import DataTable, { type SortState, type ColumnDef } from "@/components/ui/DataTable";
import UserAvatar from "@/components/ui/UserAvatar";
import type { TimeOffBalance, LeaveType } from "@/types";

interface BalancesTableProps {
  balances: TimeOffBalance[];
  leaveTypes: LeaveType[];
  year: number;
}

export default function BalancesTable({ balances: initialBalances, leaveTypes, year }: BalancesTableProps) {
  const [sort, setSort] = useState<SortState>({ col: "name", dir: "asc" });
  const [selectedYear, setSelectedYear] = useState(year);
  const [balances, setBalances] = useState(initialBalances);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear + 1; y >= 2024; y--) yearOptions.push(y);

  async function handleYearChange(newYear: number) {
    setSelectedYear(newYear);
    if (newYear === year) {
      setBalances(initialBalances);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/time-off/balances?year=${newYear}`);
      if (res.ok) setBalances(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const sortedBalances = useMemo(() => {
    const sorted = [...balances];
    if (!sort.col) return sorted;

    sorted.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sort.col) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "role": aVal = a.role; bVal = b.role; break;
        case "allowance": aVal = a.allowance; bVal = b.allowance; break;
        case "remaining": aVal = a.remaining; bVal = b.remaining; break;
        default: {
          // Leave type slug columns
          aVal = a.usedByType[sort.col!] ?? 0;
          bVal = b.usedByType[sort.col!] ?? 0;
          break;
        }
      }

      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal as string);
        return sort.dir === "asc" ? cmp : -cmp;
      }
      return sort.dir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [balances, sort]);

  const handleSort = (col: string) => {
    setSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const columns: ColumnDef<TimeOffBalance>[] = useMemo(() => {
    const cols: ColumnDef<TimeOffBalance>[] = [
      {
        key: "name",
        label: "Employee",
        minWidth: 200,
        sortable: true,
        sticky: true,
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <UserAvatar name={row.name} image={row.image} size={28} />
            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {row.name}
            </span>
          </div>
        ),
      },
      {
        key: "role",
        label: "Role",
        minWidth: 120,
        sortable: true,
        render: (row) => (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>{row.role}</span>
        ),
      },
      {
        key: "allowance",
        label: "Allowance",
        minWidth: 100,
        sortable: true,
        render: (row) => (
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {row.allowance}
          </span>
        ),
      },
    ];

    // Add a column per leave type showing days used
    for (const lt of leaveTypes) {
      cols.push({
        key: lt.slug,
        label: lt.label,
        minWidth: 100,
        sortable: true,
        render: (row) => {
          const used = row.usedByType[lt.slug] ?? 0;
          return (
            <span className="text-sm" style={{ color: used > 0 ? lt.color : "var(--text-muted)" }}>
              {used > 0 ? used : "—"}
            </span>
          );
        },
      });
    }

    cols.push({
      key: "remaining",
      label: "Remaining",
      minWidth: 100,
      sortable: true,
      render: (row) => {
        const color = row.remaining > 5
          ? "#16a34a"
          : row.remaining > 0
            ? "#d97706"
            : "#dc2626";
        return (
          <span className="text-sm font-semibold" style={{ color }}>
            {row.remaining}
          </span>
        );
      },
    });

    return cols;
  }, [leaveTypes]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3
          className="typo-card-title"
          style={{ color: "var(--text-primary)" }}
        >
          Leave Balances
        </h3>
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="rounded-lg border px-2 py-1 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {balances.length} team member{balances.length !== 1 ? "s" : ""}
        </span>
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Loading...
        </div>
      ) : (
      <DataTable
        columns={columns}
        rows={sortedBalances}
        getRowKey={(row) => row.userId}
        sort={sort}
        onSort={handleSort}
        emptyMessage="No team members found"
      />
      )}
    </div>
  );
}
