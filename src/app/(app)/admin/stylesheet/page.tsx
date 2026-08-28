"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { TaskRow, SubtaskRow } from "@/components/ui/task-row";
import GanttTimeline, { GanttSection } from "@/components/ui/GanttTimeline";
import SectionCard from "@/components/ui/SectionCard";
import ArchetypePill, { type ArchetypeLite } from "@/components/surveys/ArchetypePill";
import ModeChip from "@/components/surveys/ModeChip";
import SaveStateChip from "@/components/surveys/SaveStateChip";
import { ChartProvider } from "@/components/charts/ChartContext";
import { StackedRankBar } from "@/components/charts/StackedRankBar";
import { RankMiniHistogram } from "@/components/charts/RankMiniHistogram";
import { MCSortedBar, type MCChoiceDatum } from "@/components/charts/MCSortedBar";
import { MCDonut } from "@/components/charts/MCDonut";
import { MCDotMatrix } from "@/components/charts/MCDotMatrix";
import { MCStackedSingleBar } from "@/components/charts/MCStackedSingleBar";
import { RankPodium, type RankItemDatum } from "@/components/charts/RankPodium";
import { RankSortedBar } from "@/components/charts/RankSortedBar";
import { RankVerticalSortedBar } from "@/components/charts/RankVerticalSortedBar";
import { RankHeatmap } from "@/components/charts/RankHeatmap";
import { RankTopOneShareBar } from "@/components/charts/RankTopOneShareBar";
import { RankTintedStack } from "@/components/charts/RankTintedStack";
import { ScaleDotPlot } from "@/components/charts/ScaleDotPlot";
import { LikertDivergingBar } from "@/components/charts/LikertDivergingBar";
import { ScaleMeanSpread } from "@/components/charts/ScaleMeanSpread";
import type { ScaleSeries } from "@/components/charts/scale-series";
import { ChartPicker } from "@/components/survey-results/ChartPicker";
import type { Task } from "@/types";

const section = "mb-10";
const sectionTitle = "typo-section-header mb-4";
const row = "flex flex-wrap items-center gap-3 mb-3";
const label = "text-xs w-20 shrink-0";

// ── Mock task factory ────────────────────────────────────────────────────────

function mk(partial: Partial<Task> & { id: string; title: string }): Task {
  return {
    assignees: [],
    createdById: "u1",
    createdByName: "Demo User",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...partial,
  };
}

const noop = () => {};
const noopAsync = async () => {};

// ── Mock Gantt data ──────────────────────────────────────────────────────────

const _TODAY = new Date();
_TODAY.setHours(0, 0, 0, 0);
const _d = (offsetDays: number) =>
  new Date(_TODAY.getTime() + offsetDays * 86_400_000);

const MOCK_GANTT_SECTIONS: GanttSection[] = [
  {
    key: "current",
    label: "Current",
    rows: [
      { id: "mg1", label: "Brand Identity",    sublabel: "Design",      start: _d(-45), end: _d(30),  variant: "active" },
      { id: "mg2", label: "Website Redesign",  sublabel: "Development", start: _d(-10), end: _d(60),  variant: "active" },
    ],
  },
  {
    key: "upcoming",
    label: "Upcoming",
    rows: [
      { id: "mg3", label: "SEO Audit",         sublabel: "Marketing",   start: _d(45),  end: _d(90),  variant: "upcoming" },
    ],
  },
  {
    key: "completed",
    label: "Completed",
    defaultCollapsed: true,
    rows: [
      { id: "mg4", label: "Discovery Sprint",  sublabel: "Strategy",    start: _d(-120), end: _d(-60), variant: "muted" },
    ],
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StylesheetPage() {
  const [expanded, setExpanded] = useState(true);

  // Mock tasks for each variant
  const tDefault      = mk({ id: "t1", title: "Default open task" });
  const tDesc         = mk({ id: "t2", title: "Task with description", description: "This is a short description that gives extra context about what needs to be done." });
  const tDue          = mk({ id: "t3", title: "Task with due date", completionDate: "2026-04-15" });
  const tOverdue      = mk({ id: "t4", title: "Overdue task", completionDate: "2026-03-01" });
  const tOverdueSub   = mk({ id: "t5", title: "Task with overdue subtask" });
  const tOverdueSubChild = mk({ id: "t5s1", title: "Overdue subtask", parentTaskId: "t5", completionDate: "2026-03-01" });
  const tExpanded     = mk({ id: "t6", title: "Task with subtasks (expanded)" });
  const tExpandedSub1 = mk({ id: "t6s1", title: "Open subtask", parentTaskId: "t6" });
  const tExpandedSub2 = mk({ id: "t6s2", title: "Completed subtask", parentTaskId: "t6", completedAt: "2026-03-20T00:00:00.000Z", completedByName: "Demo User" });
  const tCollapsed    = mk({ id: "t7", title: "Task with subtasks (collapsed)" });
  const tCollapsedSub1 = mk({ id: "t7s1", title: "First subtask", parentTaskId: "t7" });
  const tCollapsedSub2 = mk({ id: "t7s2", title: "Second subtask", parentTaskId: "t7" });
  const tCollapsedSub3 = mk({ id: "t7s3", title: "Third subtask", parentTaskId: "t7" });
  const tDone         = mk({ id: "t8", title: "Completed task", completedAt: "2026-03-25T00:00:00.000Z", completedByName: "Demo User" });
  const tLogDerived   = mk({ id: "t9", title: "Follow-up from a log entry", logId: "log1" });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "..." }]}
        title="Stylesheet"
      />
      <div className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-3xl">

      {/* ── Buttons ── */}
      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Buttons
        </p>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>primary</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-primary">
            <Plus size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-primary" disabled>
            <Plus size={14} /> Disabled
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>secondary</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-secondary">
            <Pencil size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-secondary" disabled>
            <Pencil size={14} /> Disabled
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>border</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border btn-border">
            <Pencil size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border btn-border" disabled>
            <Pencil size={14} /> Disabled
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>danger</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-danger">
            <Trash2 size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-danger" disabled>
            <Trash2 size={14} /> Disabled
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>ghost</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-ghost">
            <Plus size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-ghost" disabled>
            <Plus size={14} /> Disabled
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>tertiary</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-tertiary">
            <Plus size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-tertiary" disabled>
            <Plus size={14} /> Disabled
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>link</span>
          <button className="text-sm btn-link">Button</button>
          <button className="text-sm btn-link" disabled>Disabled</button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>icon</span>
          <button className="p-1.5 rounded-md btn-icon" title="Edit">
            <Pencil size={14} />
          </button>
          <button className="p-1.5 rounded-md btn-icon" title="Add">
            <Plus size={14} />
          </button>
          <button className="p-1.5 rounded-md btn-icon text-[var(--danger)]" title="Delete">
            <Trash2 size={14} />
          </button>
          <button className="p-1.5 rounded-md btn-icon" title="Disabled" disabled>
            <Pencil size={14} />
          </button>
        </div>

        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>action</span>
          <button className="btn-action">
            <Plus size={18} />
            Button
          </button>
          <button className="btn-action" disabled>
            <Plus size={18} />
            Disabled
          </button>
        </div>
      </div>

      {/* ── Task list items ── */}
      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Task list items
        </p>

        <div className="border rounded-xl px-2" style={{ borderColor: "var(--border)" }}>

          <TaskRow task={tDefault} subtasks={[]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tDesc} subtasks={[]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tDue} subtasks={[]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tOverdue} subtasks={[]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tOverdueSub} subtasks={[tOverdueSubChild]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tExpanded} subtasks={[tExpandedSub1, tExpandedSub2]} isExpanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tCollapsed} subtasks={[tCollapsedSub1, tCollapsedSub2, tCollapsedSub3]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

          <TaskRow task={tLogDerived} subtasks={[]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop}
            onViewInLogbook={noop} />

          <TaskRow task={tDone} subtasks={[]} isExpanded={false}
            onToggleExpand={noop} onToggleComplete={noop} onEdit={noop}
            onAddSubtask={noop} onDelete={noop}
            showInlineSubtask={false} onInlineSubtaskSave={noopAsync} onInlineSubtaskCancel={noop} />

        </div>

        <p className={sectionTitle + " mt-8"} style={{ color: "var(--text-muted)" }}>
          Subtask list items
        </p>

        <div className="border rounded-xl px-2 pl-14" style={{ borderColor: "var(--border)" }}>
          <SubtaskRow task={tExpandedSub1}
            onToggleComplete={noop} onEdit={noop} onDelete={noop} />
          <SubtaskRow task={tExpandedSub2}
            onToggleComplete={noop} onEdit={noop} onDelete={noop} />
        </div>
      </div>

      {/* ── Surveys primitives ── */}
      <SurveyPrimitivesShowcase />

      </div>{/* end max-w-3xl */}

      {/* ── Gantt Timeline — full-width, outside max-w-3xl ── */}
      <div className="px-8 pb-8">
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Gantt Timeline
        </p>
        <GanttTimeline sections={MOCK_GANTT_SECTIONS} onBarClick={noop} />
      </div>

      </div>{/* end overflow-y-auto */}
    </div>
  );
}

// ── Surveys primitives showcase ─────────────────────────────

const DEMO_ARCHETYPES: ArchetypeLite[] = [
  { id: "sage", name: "Sage", color: "#7C3AED" },
  { id: "ruler", name: "Ruler", color: "#0EA5E9" },
  { id: "caregiver", name: "Caregiver", color: "#10B981" },
  { id: "creator", name: "Creator", color: "#F59E0B" },
  { id: "hero", name: "Hero", color: "#EF4444" },
];

function SurveyPrimitivesShowcase() {
  // Stable per-mount reference for the "Saved Xs ago" demo — Date.now() in render
  // would re-run on every render and trip react-hooks/purity.
  const [demoSavedAt] = useState(() => Date.now() - 2500);
  return (
    <>
      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Archetype survey — chips & pills
        </p>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>Mode</span>
          <ModeChip mode="template" />
          <ModeChip mode="snapshot" context="Acme · Q2" />
          <ModeChip mode="readonly" />
        </div>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>Save state</span>
          <SaveStateChip state="saving" />
          <SaveStateChip state="saved" savedAt={demoSavedAt} />
          <SaveStateChip state="error" onRetry={() => {}} />
        </div>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>Archetype</span>
          {DEMO_ARCHETYPES.map((a) => (
            <ArchetypePill key={a.id} archetype={a} variant="solid" />
          ))}
        </div>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>(soft)</span>
          {DEMO_ARCHETYPES.map((a) => (
            <ArchetypePill key={a.id} archetype={a} variant="soft" />
          ))}
        </div>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>(outline)</span>
          {DEMO_ARCHETYPES.map((a) => (
            <ArchetypePill key={a.id} archetype={a} variant="outline" />
          ))}
        </div>
      </div>

      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          SectionCard variants
        </p>
        <SectionCard
          title="Closing question"
          helper="Optional free-text prompt shown after the last section."
          action={
            <button className="btn-primary px-3 py-1.5 rounded-button text-xs">Action</button>
          }
        >
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Default variant with header bar (title + helper + action) and content.
          </p>
        </SectionCard>

        <div className="mt-3">
          <SectionCard title="With tone" tone="warning" helper="warning tone left-rail">
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              Tones: warning / danger / info. Used for incomplete states.
            </p>
          </SectionCard>
        </div>

        <div className="mt-3">
          <SectionCard title="Locked" locked>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              Post-publish snapshot. Content is dimmed and non-interactive.
            </p>
          </SectionCard>
        </div>

        <div className="mt-3">
          <SectionCard title="With footer" footer={
            <div className="flex w-full justify-between">
              <button className="btn-ghost px-3 py-1.5 rounded-button text-sm">← Previous</button>
              <button className="btn-ghost px-3 py-1.5 rounded-button text-sm">Next →</button>
            </div>
          }>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              Footer slot for navigation / add-X CTA.
            </p>
          </SectionCard>
        </div>

        <div className="mt-3">
          <SectionCard title="With nested rows" helper="Question rows inside a section card">
            <SectionCard variant="nested" title="Question 1: How we want to lead" action={
              <>
                <button className="btn-icon"><Pencil size={12} /></button>
                <button className="btn-icon-danger"><Trash2 size={12} /></button>
              </>
            }>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Nested variant — no border, bg-elevated, smaller padding.
              </p>
            </SectionCard>
            <div className="mt-2">
              <SectionCard variant="nested" title="Question 2: Day-to-day tone">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Another nested row.</p>
              </SectionCard>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Survey results — charts (internal mode)
        </p>
        <ChartProvider mode="internal">
          <SurveyChartsDemo />
        </ChartProvider>
      </div>

      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Survey results — charts (branded mode, accent #ff7a59)
        </p>
        <ChartProvider mode="branded" clientAccent="#ff7a59">
          <div
            className="rounded-card border p-4"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <SurveyChartsDemo />
          </div>
        </ChartProvider>
      </div>

      <div className={section}>
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Input composite
        </p>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>default</span>
          <input type="text" className="input" placeholder="Standard input" defaultValue="Editable value" />
        </div>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>sm</span>
          <input type="text" className="input input-sm" placeholder="Smaller variant" />
        </div>
        <div className={row}>
          <span className={label} style={{ color: "var(--text-muted)" }}>disabled</span>
          <input type="text" className="input" defaultValue="Read-only" disabled />
        </div>
      </div>
    </>
  );
}

// ── Survey charts demo (used in both internal + branded mode sections) ────

const DEMO_RANK_SEGMENTS = [
  { key: "sage", label: "Sage", value: 38, color: "var(--accent-0)" },
  { key: "ruler", label: "Ruler", value: 24, color: "var(--accent-2)" },
  { key: "caregiver", label: "Caregiver", value: 18, color: "var(--accent-4)" },
  { key: "creator", label: "Creator", value: 12, color: "var(--accent-6)" },
  { key: "hero", label: "Hero", value: 8, color: "var(--accent-7)" },
];

// Two rows at n=2 (the real small-group case), the rest at n=12.
const DEMO_VALUE_RANKS = [
  { id: "collab", label: "Collaboration", color: "#059669", distribution: [7, 3, 2, 1, 1], meanRank: 2 },
  { id: "drive", label: "Drive", color: "#7C3AED", distribution: [3, 5, 3, 2, 1], meanRank: 2.5 },
  { id: "steward", label: "Stewardship", color: "#0891B2", distribution: [2, 3, 5, 3, 1], meanRank: 3 },
  { id: "dec", label: "Decisiveness", color: "#2563EB", distribution: [1, 2, 3, 5, 3], meanRank: 3.5 },
  { id: "ent", label: "Entrepreneurship", color: "#D97706", distribution: [1, 1, 1, 3, 8], meanRank: 4.1 },
];

const DEMO_SCALE_BOUNDS = { min: 1, max: 5 };
const DEMO_SCALE_SERIES: ScaleSeries[] = [
  { id: "drive", label: "Drive", color: "#7C3AED", n: 2, mean: 2.5, sd: 1.5, distribution: [1, 0, 0, 1, 0] },
  { id: "decisive", label: "Decisiveness", color: "#2563EB", n: 2, mean: 3.5, sd: 0.5, distribution: [0, 0, 1, 1, 0] },
  { id: "collab", label: "Collaboration", color: "#059669", n: 12, mean: 3.3, sd: 1.1, distribution: [1, 2, 3, 4, 2] },
  { id: "entrepreneur", label: "Entrepreneurship", color: "#D97706", n: 12, mean: 4.1, sd: 0.9, distribution: [0, 1, 2, 4, 5] },
  { id: "steward", label: "Stewardship", color: "#0891B2", n: 12, mean: 2.4, sd: 1.3, distribution: [4, 3, 2, 2, 1] },
];

const DEMO_CHOICES: MCChoiceDatum[] = [
  { id: "a", label: "Strongly improve", count: 14, percentage: 56 },
  { id: "b", label: "Slightly improve", count: 6, percentage: 24 },
  { id: "c", label: "No change", count: 3, percentage: 12 },
  { id: "d", label: "Get worse", count: 2, percentage: 8 },
];

const DEMO_RANK_ITEMS: RankItemDatum[] = [
  { id: "customer-centric", label: "Customer-Centric", score: 42, scoreLabel: "42%", scoreUnit: "of votes", distribution: [5, 4, 0, 0, 0, 3] },
  { id: "innovation",       label: "Innovation",       score: 29, scoreLabel: "29%", scoreUnit: "of votes", distribution: [3, 5, 3, 0, 0, 1] },
  { id: "achievement",      label: "Achievement",      score: 18, scoreLabel: "18%", scoreUnit: "of votes", distribution: [0, 2, 5, 4, 0, 1] },
  { id: "one-team",         label: "One Team",         score: 14, scoreLabel: "14%", scoreUnit: "of votes", distribution: [0, 0, 0, 4, 3, 0] },
  { id: "greater-good",     label: "Greater Good",     score: 7,  scoreLabel: "7%",  scoreUnit: "of votes", distribution: [0, 0, 0, 0, 3, 4] },
  { id: "hero",             label: "Hero",             score: 3,  scoreLabel: "3%",  scoreUnit: "of votes", distribution: [0, 0, 0, 0, 0, 4] },
];

function SurveyChartsDemo() {
  return (
    <div className="space-y-6">
      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          StackedRankBar
        </p>
        <StackedRankBar segments={DEMO_RANK_SEGMENTS} />
        <p className="typo-section-header mb-2 mt-4" style={{ color: "var(--text-muted)" }}>
          StackedRankBar — low confidence
        </p>
        <StackedRankBar segments={DEMO_RANK_SEGMENTS} lowConfidence />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankMiniHistogram (vertical mini bars)
        </p>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex flex-col items-center gap-1">
            unanimous #1
            <RankMiniHistogram distribution={[12, 0, 0, 0, 0]} />
          </span>
          <span className="inline-flex flex-col items-center gap-1">
            always #2
            <RankMiniHistogram distribution={[0, 12, 0, 0, 0]} />
          </span>
          <span className="inline-flex flex-col items-center gap-1">
            split high/low
            <RankMiniHistogram distribution={[6, 0, 0, 0, 6]} />
          </span>
          <span className="inline-flex flex-col items-center gap-1">
            no data
            <RankMiniHistogram distribution={[0, 0, 0, 0, 0]} />
          </span>
        </div>
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          ChartPicker (tab switcher)
        </p>
        <ChartPickerDemo />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          MCSortedBar (MC default)
        </p>
        <MCSortedBar choices={DEMO_CHOICES} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          MCDonut
        </p>
        <MCDonut choices={DEMO_CHOICES} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          MCDotMatrix
        </p>
        <MCDotMatrix choices={DEMO_CHOICES} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          MCStackedSingleBar
        </p>
        <MCStackedSingleBar choices={DEMO_CHOICES} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankPodium (ranking default)
        </p>
        <RankPodium items={DEMO_RANK_ITEMS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankSortedBar (horizontal)
        </p>
        <RankSortedBar items={DEMO_RANK_ITEMS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankVerticalSortedBar
        </p>
        <RankVerticalSortedBar items={DEMO_RANK_ITEMS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankHeatmap
        </p>
        <RankHeatmap
          items={DEMO_RANK_ITEMS.map((i) => ({ id: i.id, label: i.label, distribution: i.distribution }))}
        />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankTintedStack (value-ranking — tints of each value&apos;s own colour)
        </p>
        <RankTintedStack items={DEMO_VALUE_RANKS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          ScaleDotPlot (value-assessment default)
        </p>
        <ScaleDotPlot series={DEMO_SCALE_SERIES} bounds={DEMO_SCALE_BOUNDS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          LikertDivergingBar
        </p>
        <LikertDivergingBar series={DEMO_SCALE_SERIES} bounds={DEMO_SCALE_BOUNDS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          ScaleMeanSpread
        </p>
        <ScaleMeanSpread series={DEMO_SCALE_SERIES} bounds={DEMO_SCALE_BOUNDS} />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankHeatmap — ordered-scale columns
        </p>
        <RankHeatmap
          items={DEMO_SCALE_SERIES.map((s) => ({ id: s.id, label: s.label, distribution: s.distribution }))}
          columnLabels={["1", "2", "3", "4", "5"]}
          rowHeader="Value"
          columnNoun="score"
        />
      </div>

      <div>
        <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
          RankTopOneShareBar
        </p>
        <RankTopOneShareBar
          items={DEMO_RANK_ITEMS.map((i) => ({
            id: i.id,
            label: i.label,
            topOneCount: i.distribution[0] ?? 0,
          }))}
          n={12}
        />
      </div>
    </div>
  );
}

function ChartPickerDemo() {
  const [value, setValue] = useState("podium");
  return (
    <ChartPicker
      value={value}
      onChange={setValue}
      options={[
        { key: "podium", label: "Podium" },
        { key: "sorted-bar", label: "Sorted bar" },
        { key: "heatmap", label: "Heatmap" },
        { key: "top-one", label: "Top-1 share" },
      ]}
    />
  );
}
