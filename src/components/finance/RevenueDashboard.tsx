"use client";

import { useMemo, useState } from "react";
import type { RevenueAnalytics, RevenueRow } from "@/types";
import { colorForCategory } from "@/components/charts/ChartTheme";
import { formatEuro, formatEuroShort, quarterLabel } from "./format";
import SegmentedControl from "./SegmentedControl";
import KpiStrip from "./KpiStrip";
import RevenueTable, { type RevenueTableRow } from "./RevenueTable";
import RevenueTrendChart from "./charts/RevenueTrendChart";
import RevenueDonut, { type DonutSegment } from "./charts/RevenueDonut";
import PriceTrendChart from "./charts/PriceTrendChart";
import RankBars, { type RankItem } from "./charts/RankBars";

type Period = "year" | "quarter";
type GroupBy = "service" | "label";
type Metric = "omzet" | "marge";
type YearSel = number | "all";

export default function RevenueDashboard({ data }: { data: RevenueAnalytics }) {
  const latestYear = data.years.length ? data.years[data.years.length - 1] : "all";
  const [period, setPeriod] = useState<Period>("year");
  const [year, setYear] = useState<YearSel>(latestYear);
  const [groupBy, setGroupBy] = useState<GroupBy>("service");
  const [metric, setMetric] = useState<Metric>("omzet");

  // ── buckets ──────────────────────────────────────────────────────────
  const { realizedRows, ongoingRows, pipelineRows } = useMemo(() => {
    return {
      realizedRows: data.rows.filter((r) => r.bucket === "realized"),
      ongoingRows: data.rows.filter((r) => r.bucket === "ongoing"),
      pipelineRows: data.rows.filter((r) => r.bucket === "pipeline"),
    };
  }, [data]);

  const scopedRealized = useMemo(
    () => realizedRows.filter((r) => year === "all" || r.recogYear === year),
    [realizedRows, year]
  );

  // ── KPIs ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const omzet = scopedRealized.reduce((s, r) => s + r.omzet, 0);
    const marge = scopedRealized.reduce((s, r) => s + r.marge, 0);
    const clients = new Set(scopedRealized.map((r) => r.clientId)).size;
    const lopend = ongoingRows.reduce((s, r) => s + r.omzet, 0);
    const pipeline = pipelineRows.reduce((s, r) => s + r.omzet, 0);
    return {
      omzet,
      marge,
      perClient: clients > 0 ? omzet / clients : 0,
      lopend,
      pipeline,
    };
  }, [scopedRealized, ongoingRows, pipelineRows]);

  // ── trend (stacked, full history in year mode / selected year in quarter mode) ──
  const trend = useMemo(() => {
    const metricVal = (r: RevenueRow) => (metric === "omzet" ? r.omzet : r.marge);
    const gName = (r: RevenueRow) => (groupBy === "service" ? r.service : r.label);
    let periods: string[];
    if (period === "year") periods = data.years.map(String);
    else if (year === "all") periods = data.quarters;
    else periods = [1, 2, 3, 4].map((q) => `${year}-Q${q}`);

    const periodOf = (r: RevenueRow) =>
      period === "year" ? (r.recogYear != null ? String(r.recogYear) : null) : r.recogQuarter;

    const periodSet = new Set(periods);
    const pivot = new Map<string, Map<string, number>>();
    const groupTotals = new Map<string, number>();
    for (const r of realizedRows) {
      const g = gName(r);
      groupTotals.set(g, (groupTotals.get(g) ?? 0) + metricVal(r));
      const p = periodOf(r);
      if (!p || !periodSet.has(p)) continue;
      if (!pivot.has(p)) pivot.set(p, new Map());
      const m = pivot.get(p)!;
      m.set(g, (m.get(g) ?? 0) + metricVal(r));
    }

    const series = [...groupTotals.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => ({ key, color: colorForCategory(key) }));

    const valueAt = (p: string, k: string) => pivot.get(p)?.get(k) ?? 0;
    const highlight = period === "year" && year !== "all" ? String(year) : undefined;
    return { periods, series, valueAt, highlight };
  }, [period, year, groupBy, metric, data, realizedRows]);

  // ── donuts (omzet composition, scoped year) ──────────────────────────
  const serviceDonut = useMemo(() => donutFrom(scopedRealized, (r) => r.service, (r) => r.serviceId), [scopedRealized]);
  const labelDonut = useMemo(() => donutFrom(scopedRealized, (r) => r.label, (r) => r.labelId), [scopedRealized]);

  // ── top clients (omzet, scoped) ──────────────────────────────────────
  const topClients = useMemo<RankItem[]>(() => {
    const m = new Map<string, { label: string; value: number }>();
    for (const r of scopedRealized) {
      const cur = m.get(r.clientId) ?? { label: r.company, value: 0 };
      cur.value += r.omzet;
      m.set(r.clientId, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, label: v.label, value: v.value }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [scopedRealized]);

  // ── avg revenue per service (scoped) ─────────────────────────────────
  const avgPerService = useMemo<RankItem[]>(() => {
    const m = new Map<string, { sum: number; count: number }>();
    for (const r of scopedRealized) {
      const cur = m.get(r.service) ?? { sum: 0, count: 0 };
      cur.sum += r.omzet;
      cur.count += 1;
      m.set(r.service, cur);
    }
    return [...m.entries()]
      .map(([name, v]) => ({
        id: name,
        label: name,
        value: v.count > 0 ? Math.round(v.sum / v.count) : 0,
        sublabel: `${v.count} ${v.count === 1 ? "project" : "projecten"}`,
        color: colorForCategory(name),
      }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [scopedRealized]);

  // ── price evolution per service (all buckets, by sale year) ──────────
  const priceTrend = useMemo(() => {
    const years = data.saleYears;
    const byService = new Map<string, Map<number, { sum: number; count: number }>>();
    const serviceCount = new Map<string, number>();
    for (const r of data.rows) {
      if (r.saleYear == null || r.serviceId == null) continue; // real services only
      serviceCount.set(r.service, (serviceCount.get(r.service) ?? 0) + 1);
      if (!byService.has(r.service)) byService.set(r.service, new Map());
      const ym = byService.get(r.service)!;
      const cell = ym.get(r.saleYear) ?? { sum: 0, count: 0 };
      cell.sum += r.omzet;
      cell.count += 1;
      ym.set(r.saleYear, cell);
    }
    const topServices = [...serviceCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
    const series = topServices.map((s) => ({
      key: s,
      color: colorForCategory(s),
      points: years.map((y) => {
        const cell = byService.get(s)?.get(y);
        return { year: y, value: cell && cell.count > 0 ? Math.round(cell.sum / cell.count) : null };
      }),
    }));
    return { years, series };
  }, [data]);

  // ── per-client table ─────────────────────────────────────────────────
  const tableRows = useMemo<RevenueTableRow[]>(() => {
    const m = new Map<string, RevenueTableRow>();
    const ensure = (clientId: string, company: string) => {
      let row = m.get(clientId);
      if (!row) {
        row = { clientId, company, realized: 0, marge: 0, ongoing: 0, pipeline: 0 };
        m.set(clientId, row);
      }
      return row;
    };
    for (const r of scopedRealized) {
      const row = ensure(r.clientId, r.company);
      row.realized += r.omzet;
      row.marge += r.marge;
    }
    for (const r of ongoingRows) ensure(r.clientId, r.company).ongoing += r.omzet;
    for (const r of pipelineRows) ensure(r.clientId, r.company).pipeline += r.omzet;
    return [...m.values()].filter((r) => r.realized || r.ongoing || r.pipeline || r.marge);
  }, [scopedRealized, ongoingRows, pipelineRows]);

  const yearLabel = year === "all" ? "alle jaren" : String(year);

  if (data.rows.length === 0) {
    return (
      <div
        className="rounded-card border p-10 text-center"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
          Nog geen omzet om te tonen
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Zodra projecten een prijs en een opleverdatum hebben, verschijnt hier het historische omzetbeeld.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ maxWidth: 1200 }}>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Control label="Periode">
          <SegmentedControl
            ariaLabel="Periode"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "year", label: "Jaar" },
              { value: "quarter", label: "Kwartaal" },
            ]}
          />
        </Control>
        <Control label="Jaar">
          <select
            value={year === "all" ? "all" : String(year)}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="text-[13px] rounded-button px-2 py-1.5 border focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              ["--tw-ring-color" as string]: "var(--primary)",
            }}
          >
            <option value="all">Alle jaren</option>
            {[...data.years].reverse().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Control>
        <Control label="Uitsplitsing">
          <SegmentedControl
            ariaLabel="Uitsplitsing"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "service", label: "Service" },
              { value: "label", label: "Label" },
            ]}
          />
        </Control>
        <Control label="Bedrag in grafiek">
          <SegmentedControl
            ariaLabel="Bedrag"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "omzet", label: "Omzet" },
              { value: "marge", label: "Marge" },
            ]}
          />
        </Control>
      </div>

      {/* KPIs */}
      <KpiStrip
        primary={{
          label: `Gerealiseerde omzet · ${yearLabel}`,
          value: formatEuro(kpis.omzet),
          hint: "Geboekt op opleverdatum",
        }}
        secondary={[
          { label: "Marge", value: formatEuro(kpis.marge) },
          { label: "Gem. per klant", value: formatEuro(Math.round(kpis.perClient)) },
          { label: "Lopend", value: formatEuro(kpis.lopend), tone: "muted" },
          { label: "Pipeline", value: formatEuro(kpis.pipeline), tone: "muted" },
        ]}
      />

      {/* Trend — full-width */}
      <ChartCard
        title={`${metric === "omzet" ? "Omzet" : "Marge"} per ${period === "year" ? "jaar" : "kwartaal"}`}
        caption={`Gestapeld per ${groupBy === "service" ? "service" : "label"}. Geboekt op opleverdatum; lopende en pipeline-projecten tellen hier nog niet mee.`}
      >
        <RevenueTrendChart
          periods={trend.periods}
          periodLabel={(p) => (period === "quarter" ? quarterLabel(p) : p)}
          series={trend.series}
          valueAt={trend.valueAt}
          formatValue={formatEuro}
          formatTick={formatEuroShort}
          highlight={trend.highlight}
          height={260}
        />
      </ChartCard>

      {/* Breakdown row */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <ChartCard title="Omzet per servicetype" caption={yearLabel}>
          <RevenueDonut
            segments={serviceDonut}
            centerValue={formatEuroShort(serviceDonut.reduce((s, d) => s + d.value, 0))}
            centerLabel="Omzet"
            formatValue={formatEuro}
          />
        </ChartCard>
        <ChartCard title="Omzet per label" caption={yearLabel}>
          <RevenueDonut
            segments={labelDonut}
            centerValue={formatEuroShort(labelDonut.reduce((s, d) => s + d.value, 0))}
            centerLabel="Omzet"
            formatValue={formatEuro}
          />
        </ChartCard>
        <ChartCard title="Top klanten" caption={`Op omzet · ${yearLabel}`}>
          <RankBars items={topClients} formatValue={formatEuro} emptyText="Geen omzet in deze periode." />
        </ChartCard>
      </div>

      {/* Price + averages row */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <ChartCard
          title="Prijsontwikkeling per service"
          caption="Gemiddelde verkoopprijs per project, per verkoopjaar. Een stijging kan ook mix-gedreven zijn."
        >
          <PriceTrendChart
            years={priceTrend.years}
            series={priceTrend.series}
            formatValue={formatEuro}
            formatTick={formatEuroShort}
            height={230}
          />
        </ChartCard>
        <ChartCard title="Gemiddelde omzet per service" caption={`Totaal ÷ projecten · ${yearLabel}`}>
          <RankBars items={avgPerService} formatValue={formatEuro} emptyText="Geen omzet in deze periode." />
        </ChartCard>
      </div>

      {/* Detail table */}
      <ChartCard
        title="Per klant"
        caption="Gerealiseerd is geboekt op opleverdatum; lopend en pipeline zijn vooruitblikkend (alle jaren)."
      >
        <RevenueTable
          rows={tableRows}
          formatValue={formatEuro}
          realizedLabel={year === "all" ? "Alle jaren" : `Gerealiseerd in ${year}`}
        />
      </ChartCard>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function donutFrom(
  rows: RevenueRow[],
  nameOf: (r: RevenueRow) => string,
  idOf: (r: RevenueRow) => string | null
): DonutSegment[] {
  const m = new Map<string, { label: string; value: number }>();
  for (const r of rows) {
    const key = idOf(r) ?? `__${nameOf(r)}`;
    const cur = m.get(key) ?? { label: nameOf(r), value: 0 };
    cur.value += r.omzet;
    m.set(key, cur);
  }
  return [...m.entries()]
    .map(([id, v]) => ({ id, label: v.label, value: v.value, color: colorForCategory(v.label) }))
    .filter((s) => s.value > 0);
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="typo-section-header" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
      <header className="mb-4">
        <h3 className="typo-card-title" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        {caption && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {caption}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}
