"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CheckSquare, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TaskRow } from "@/components/ui/task-row";
import type { Task, MyDayTaskData } from "@/types";
import { resolveClientColor } from "@/lib/styles";

// ── Helpers ──────────────────────────────────────────────────────────────────

function monogram(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

type EnrichedTask = Task & { clientName: string; clientPrimaryColor?: string; projectName?: string };

interface ClientGroup {
  clientId: string;
  clientName: string;
  clientPrimaryColor?: string;
  projects: { projectId: string | null; projectName: string; tasks: EnrichedTask[] }[];
  totalOpen: number;
}

function groupByClientAndProject(tasks: EnrichedTask[]): ClientGroup[] {
  const clientMap = new Map<string, { clientName: string; clientPrimaryColor?: string; projectMap: Map<string | null, { name: string; tasks: EnrichedTask[] }> }>();

  for (const t of tasks) {
    const cid = t.clientId ?? "unknown";
    if (!clientMap.has(cid)) {
      clientMap.set(cid, { clientName: t.clientName, clientPrimaryColor: t.clientPrimaryColor, projectMap: new Map() });
    }
    const client = clientMap.get(cid)!;
    const pid = t.projectId ?? null;
    if (!client.projectMap.has(pid)) {
      client.projectMap.set(pid, { name: t.projectName ?? "General", tasks: [] });
    }
    client.projectMap.get(pid)!.tasks.push(t);
  }

  const groups: ClientGroup[] = [];
  for (const [clientId, { clientName, clientPrimaryColor, projectMap }] of clientMap) {
    const projects: ClientGroup["projects"] = [];
    let totalOpen = 0;
    // Put "General" (null projectId) last
    const sorted = [...projectMap.entries()].sort((a, b) => {
      if (a[0] === null) return 1;
      if (b[0] === null) return -1;
      return 0;
    });
    for (const [projectId, { name, tasks }] of sorted) {
      projects.push({ projectId, projectName: name, tasks });
      totalOpen += tasks.length;
    }
    groups.push({ clientId, clientName, clientPrimaryColor, projects, totalOpen });
  }

  return groups;
}

// ── Chips ────────────────────────────────────────────────────────────────────

function Chip({ icon: Icon, label, bg, color }: { icon: typeof Clock; label: string; bg: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{ background: bg, color }}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  myTasks: MyDayTaskData;
  allTasks: MyDayTaskData;
  currentUserId: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MyDayTasksSection({ myTasks, allTasks, today }: Props & { today?: string }) {
  const reduceMotion = useReducedMotion();
  const todayISO = today ?? new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<"mine" | "all">("mine");
  const [myTasksState, setMyTasksState] = useState<MyDayTaskData>(myTasks);
  const [allTasksState, setAllTasksState] = useState<MyDayTaskData>(allTasks);
  const inFlightRef = useRef<Set<string>>(new Set());
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Sync props → state when the server re-renders the page (navigation, etc.).
  // We do not call router.refresh() from this component, so prop changes here
  // represent genuine fresh data and it's safe to overwrite local state.
  useEffect(() => { setMyTasksState(myTasks); }, [myTasks]);
  useEffect(() => { setAllTasksState(allTasks); }, [allTasks]);

  const activeData = filter === "mine" ? myTasksState : allTasksState;

  const visibleTasks = useMemo(
    () => activeData.tasks.filter((t) => !t.completedAt),
    [activeData.tasks]
  );

  const clientGroups = useMemo(() => groupByClientAndProject(visibleTasks), [visibleTasks]);

  // Action focus: overdue / due-today counts from the currently visible tasks.
  const { overdueCount, todayCount } = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    for (const t of visibleTasks) {
      if (!t.completionDate) continue;
      if (t.completionDate < todayISO) overdue++;
      else if (t.completionDate === todayISO) dueToday++;
    }
    return { overdueCount: overdue, todayCount: dueToday };
  }, [visibleTasks, todayISO]);

  // Auto-select first client if none selected or current selection has no tasks
  const selectedClientId = useMemo(() => {
    if (clientGroups.length === 0) return null;
    if (activeClientId && clientGroups.some((g) => g.clientId === activeClientId)) return activeClientId;
    return clientGroups[0].clientId;
  }, [activeClientId, clientGroups]);

  const selectedGroup = clientGroups.find((g) => g.clientId === selectedClientId) ?? null;

  function applyCompletedAt(taskId: string, completedAt: string | undefined) {
    const patch = (prev: MyDayTaskData): MyDayTaskData => {
      const topIdx = prev.tasks.findIndex((t) => t.id === taskId);
      if (topIdx !== -1) {
        const nextTasks = [...prev.tasks];
        nextTasks[topIdx] = { ...nextTasks[topIdx], completedAt };
        return { ...prev, tasks: nextTasks };
      }
      const nextSubs = { ...prev.subtasksByParent };
      for (const [pid, subs] of Object.entries(nextSubs)) {
        const subIdx = subs.findIndex((s) => s.id === taskId);
        if (subIdx !== -1) {
          const nextSubList = [...subs];
          nextSubList[subIdx] = { ...nextSubList[subIdx], completedAt };
          nextSubs[pid] = nextSubList;
          return { ...prev, subtasksByParent: nextSubs };
        }
      }
      return prev;
    };
    setMyTasksState(patch);
    setAllTasksState(patch);
  }

  async function handleToggleComplete(task: Task) {
    if (inFlightRef.current.has(task.id)) return;
    inFlightRef.current.add(task.id);

    const isCompleting = !task.completedAt;
    const originalCompletedAt = task.completedAt;
    const nextCompletedAt = isCompleting ? new Date().toISOString() : undefined;

    applyCompletedAt(task.id, nextCompletedAt);

    const base = `/api/clients/${task.clientId}`;
    const url = task.projectId
      ? `${base}/projects/${task.projectId}/tasks/${task.id}`
      : `${base}/tasks/${task.id}`;

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: isCompleting }),
      });
      if (!res.ok) throw new Error();
    } catch {
      applyCompletedAt(task.id, originalCompletedAt);
    } finally {
      inFlightRef.current.delete(task.id);
    }
  }

  const hasTasks = clientGroups.length > 0;
  const allClear = hasTasks && overdueCount === 0 && todayCount === 0;

  return (
    <div
      className="rounded-card border p-5 shadow-subtle sm:p-6"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {/* Header: title + action focus + filter */}
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <CheckSquare size={15} style={{ color: "var(--text-muted)" }} />
        <h2 className="typo-card-title" style={{ color: "var(--text-primary)" }}>Tasks</h2>

        {overdueCount > 0 && (
          <Chip
            icon={AlertTriangle}
            label={`${overdueCount} overdue`}
            bg="var(--danger-light)"
            color="var(--danger)"
          />
        )}
        {todayCount > 0 && (
          <Chip
            icon={Clock}
            label={`${todayCount} today`}
            bg="var(--primary-light)"
            color="var(--primary)"
          />
        )}
        {allClear && (
          <Chip
            icon={CheckCircle2}
            label="All clear"
            bg="var(--success-light)"
            color="var(--success)"
          />
        )}

        {/* Segmented mine / all filter */}
        <div
          className="ml-auto inline-flex rounded-button border p-0.5"
          style={{ borderColor: "var(--border)" }}
        >
          {(["mine", "all"] as const).map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  background: isActive ? "var(--primary-light)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text-muted)",
                }}
              >
                {f === "mine" ? "My tasks" : "All tasks"}
              </button>
            );
          })}
        </div>
      </div>

      {!hasTasks ? (
        // Delight: an earned "all caught up" moment instead of a flat empty state
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--primary-light)" }}
          >
            <CheckCircle2 size={24} style={{ color: "var(--primary)" }} />
          </div>
          <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
            All caught up
          </p>
          <p className="typo-caption" style={{ color: "var(--text-muted)" }}>
            {filter === "mine" ? "No open tasks assigned to you." : "No open tasks for your clients."}
          </p>
        </div>
      ) : (
        <>
          {/* Client tabs */}
          <div className="mb-5 flex items-center gap-4 border-b" style={{ borderColor: "var(--border)" }}>
            {clientGroups.map((group) => {
              const isActive = group.clientId === selectedClientId;
              const { bg, fg } = resolveClientColor(group.clientName, group.clientPrimaryColor);
              return (
                <button
                  key={group.clientId}
                  type="button"
                  className="group flex cursor-pointer items-center gap-1.5 pb-2.5 -mb-px transition-colors"
                  style={{ borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent" }}
                  onClick={() => setActiveClientId(group.clientId)}
                  title={group.clientName}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderBottomColor = "var(--border)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderBottomColor = "transparent"; }}
                >
                  <div
                    className="flex h-5 w-5 flex-none items-center justify-center rounded text-[10px] font-bold"
                    style={{ background: bg, color: fg }}
                  >
                    {monogram(group.clientName)}
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {group.clientName}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-medium tabular-nums"
                    style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}
                  >
                    {group.totalOpen}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Task list grouped by project — crossfades on filter / client switch */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${filter}:${selectedClientId}`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-1.5"
            >
              {selectedGroup?.projects.map(({ projectId, projectName, tasks }) => {
                const sectionKey = `${selectedGroup.clientId}::${projectId ?? "general"}`;
                const isCollapsed = collapsedProjects.has(sectionKey);
                return (
                  <div key={sectionKey}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-button px-2 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
                      onClick={() => setCollapsedProjects((prev) => {
                        const next = new Set(prev);
                        if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
                        return next;
                      })}
                    >
                      <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </span>
                      {projectId ? (
                        <Link
                          href={`/clients/${selectedGroup.clientId}/projects/${projectId}/tasks`}
                          className="truncate text-sm font-medium hover:underline"
                          style={{ color: "var(--text-primary)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {projectName}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                          {projectName}
                        </span>
                      )}
                      <span
                        className="ml-auto flex-shrink-0 rounded-badge px-2 py-0.5 text-xs font-medium tabular-nums"
                        style={{ background: "var(--bg-neutral)", color: "var(--text-muted)" }}
                      >
                        {tasks.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="px-2 pb-1.5">
                        {tasks.map((task) => {
                          const href = task.projectId
                            ? `/clients/${selectedGroup.clientId}/projects/${task.projectId}/tasks`
                            : `/clients/${selectedGroup.clientId}?tab=tasks`;
                          return (
                            <TaskRow
                              key={task.id}
                              task={task}
                              subtasks={activeData.subtasksByParent[task.id] ?? []}
                              isExpanded={expandedTasks.has(task.id)}
                              onToggleExpand={() => setExpandedTasks((prev) => {
                                const next = new Set(prev);
                                if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                                return next;
                              })}
                              onToggleComplete={handleToggleComplete}
                              onEdit={() => {}}
                              onAddSubtask={() => {}}
                              onDelete={() => {}}
                              showInlineSubtask={false}
                              onInlineSubtaskSave={async () => {}}
                              onInlineSubtaskCancel={() => {}}
                              userImages={activeData.userImages}
                              canEdit={false}
                              canDelete={false}
                              navigateHref={href}
                              today={todayISO}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
