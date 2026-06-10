"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface RevenueTableRow {
  clientId: string;
  company: string;
  realized: number;
  marge: number;
  ongoing: number;
  pipeline: number;
}

type SortKey = "company" | "realized" | "marge" | "ongoing" | "pipeline";

interface RevenueTableProps {
  rows: RevenueTableRow[];
  formatValue: (n: number) => string;
  realizedLabel: string;
}

const NUM_COLS: { key: Exclude<SortKey, "company">; label: string }[] = [
  { key: "realized", label: "Gerealiseerd" },
  { key: "marge", label: "Marge" },
  { key: "ongoing", label: "Lopend" },
  { key: "pipeline", label: "Pipeline" },
];

export default function RevenueTable({ rows, formatValue, realizedLabel }: RevenueTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "realized", dir: "desc" });

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "company" ? "asc" : "desc" }
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "company") return a.company.localeCompare(b.company) * dir;
    return (a[sort.key] - b[sort.key]) * dir;
  });

  const totals = rows.reduce(
    (acc, r) => ({
      realized: acc.realized + r.realized,
      marge: acc.marge + r.marge,
      ongoing: acc.ongoing + r.ongoing,
      pipeline: acc.pipeline + r.pipeline,
    }),
    { realized: 0, marge: 0, ongoing: 0, pipeline: 0 }
  );

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
        Geen klanten met omzet in deze periode.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <Th active={sort.key === "company"} dir={sort.dir} onClick={() => toggle("company")} align="left">
              Klant
            </Th>
            {NUM_COLS.map((c) => (
              <Th
                key={c.key}
                active={sort.key === c.key}
                dir={sort.dir}
                onClick={() => toggle(c.key)}
                align="right"
                title={c.key === "realized" ? realizedLabel : undefined}
              >
                {c.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.clientId} className="hover-row" style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="py-2 pr-3" style={{ color: "var(--text-primary)" }}>
                {r.company}
              </td>
              <Td value={r.realized} format={formatValue} strong />
              <Td value={r.marge} format={formatValue} />
              <Td value={r.ongoing} format={formatValue} muted />
              <Td value={r.pipeline} format={formatValue} muted />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="py-2 pr-3 font-semibold" style={{ color: "var(--text-primary)" }}>
              Totaal
            </td>
            <Td value={totals.realized} format={formatValue} strong />
            <Td value={totals.marge} format={formatValue} strong />
            <Td value={totals.ongoing} format={formatValue} strong muted />
            <Td value={totals.pipeline} format={formatValue} strong muted />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Th({
  children,
  active,
  dir,
  onClick,
  align,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align: "left" | "right";
  title?: string;
}) {
  return (
    <th className={`py-2 ${align === "right" ? "text-right pl-3" : "text-left pr-3"}`} title={title}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 typo-section-header transition-colors ${align === "right" ? "flex-row-reverse" : ""}`}
        style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {children}
        {active && (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );
}

function Td({
  value,
  format,
  strong,
  muted,
}: {
  value: number;
  format: (n: number) => string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`py-2 pl-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}
      style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}
    >
      {value === 0 ? "–" : format(value)}
    </td>
  );
}
