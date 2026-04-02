"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { TaskRow, SubtaskRow } from "@/components/ui/task-row";
import GanttTimeline, { GanttSection } from "@/components/ui/GanttTimeline";
import type { Task } from "@/types";

const section = "mb-10";
const sectionTitle = "text-xs font-semibold uppercase tracking-wider mb-4";
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
  const tCollapsedSub = mk({ id: "t7s1", title: "A subtask", parentTaskId: "t7" });
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
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border btn-secondary">
            <Pencil size={14} /> Button
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border btn-secondary" disabled>
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
          <button className="p-1.5 rounded-md btn-icon text-red-500" title="Delete">
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

          <TaskRow task={tCollapsed} subtasks={[tCollapsedSub]} isExpanded={false}
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

      </div>{/* end max-w-3xl */}

      {/* ── Gantt Timeline — full-width, outside max-w-3xl ── */}
      <div className="px-8 pb-8">
        <p className={sectionTitle} style={{ color: "var(--text-muted)" }}>
          Gantt Timeline
        </p>
        <GanttTimeline sections={MOCK_GANTT_SECTIONS} onRowClick={noop} />
      </div>

      </div>{/* end overflow-y-auto */}
    </div>
  );
}
