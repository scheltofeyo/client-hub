"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, CheckSquare } from "lucide-react";
import { TaskRow } from "@/components/ui/task-row";
import type { Task, MyDayTaskData } from "@/types";
import { accentColor } from "@/lib/styles";

// ── Helpers ──────────────────────────────────────────────────────────────────

function monogram(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

type EnrichedTask = Task & { clientName: string; projectName?: string };

interface ClientGroup {
  clientId: string;
  clientName: string;
  projects: { projectId: string | null; projectName: string; tasks: EnrichedTask[] }[];
  totalOpen: number;
}

function groupByClientAndProject(tasks: EnrichedTask[]): ClientGroup[] {
  const clientMap = new Map<string, { clientName: string; projectMap: Map<string | null, { name: string; tasks: EnrichedTask[] }> }>();

  for (const t of tasks) {
    const cid = t.clientId ?? "unknown";
    if (!clientMap.has(cid)) {
      clientMap.set(cid, { clientName: t.clientName, projectMap: new Map() });
    }
    const client = clientMap.get(cid)!;
    const pid = t.projectId ?? null;
    if (!client.projectMap.has(pid)) {
      client.projectMap.set(pid, { name: t.projectName ?? "General", tasks: [] });
    }
    client.projectMap.get(pid)!.tasks.push(t);
  }

  const groups: ClientGroup[] = [];
  for (const [clientId, { clientName, projectMap }] of clientMap) {
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
    groups.push({ clientId, clientName, projects, totalOpen });
  }

  return groups;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  myTasks: MyDayTaskData;
  allTasks: MyDayTaskData;
  currentUserId: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MyDayTasksSection({ myTasks, allTasks, currentUserId, today }: Props & { today?: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"mine" | "all">("mine");
  const activeData = filter === "mine" ? myTasks : allTasks;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const visibleTasks = useMemo(
    () => activeData.tasks.filter((t) => !dismissedIds.has(t.id)),
    [activeData.tasks, dismissedIds]
  );

  const clientGroups = useMemo(() => groupByClientAndProject(visibleTasks), [visibleTasks]);

  // Auto-select first client if none selected or current selection has no tasks
  const selectedClientId = useMemo(() => {
    if (clientGroups.length === 0) return null;
    if (activeClientId && clientGroups.some((g) => g.clientId === activeClientId)) return activeClientId;
    return clientGroups[0].clientId;
  }, [activeClientId, clientGroups]);

  const selectedGroup = clientGroups.find((g) => g.clientId === selectedClientId) ?? null;

  async function handleToggleComplete(task: Task) {
    const isCompleting = !task.completedAt;
    setDismissedIds((prev) => new Set(prev).add(task.id));

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
      router.refresh();
    } catch {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  const totalCount = filter === "mine" ? myTasks.tasks.length : allTasks.tasks.length;

  return (
    <div>
      {/* Header row with title and filter */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Tasks</h2>
        {totalCount > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {totalCount}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {(["mine", "all"] as const).map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: isActive ? "var(--primary-light)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text-muted)",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--primary)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                {f === "mine" ? "My tasks" : "All tasks"}
              </button>
            );
          })}
        </div>
      </div>

      {clientGroups.length === 0 ? (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <CheckSquare size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {filter === "mine" ? "No open tasks assigned to you." : "No open tasks for your clients."}
          </p>
        </div>
      ) : (
        <>
          {/* Client tabs */}
          <div className="flex items-center gap-3 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
            {clientGroups.map((group) => {
              const isActive = group.clientId === selectedClientId;
              const color = accentColor(group.clientName);
              return (
                <button
                  key={group.clientId}
                  type="button"
                  className="group flex items-center gap-1.5 pb-2 -mb-px transition-colors cursor-pointer"
                  style={{
                    borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                  }}
                  onClick={() => setActiveClientId(group.clientId)}
                  title={group.clientName}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderBottomColor = "var(--border)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderBottomColor = "transparent"; }}
                >
                  <div
                    className="w-5 h-5 rounded flex-none flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ background: color }}
                  >
                    {monogram(group.clientName)}
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {group.clientName}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}
                  >
                    {group.totalOpen}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Task list grouped by project */}
          {selectedGroup && (
            <div className="flex flex-col gap-1">
              {selectedGroup.projects.map(({ projectId, projectName, tasks }) => {
                const sectionKey = `${selectedGroup.clientId}::${projectId ?? "general"}`;
                const isCollapsed = collapsedProjects.has(sectionKey);
                return (
                  <div key={sectionKey}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-[var(--bg-hover)] rounded-lg"
                      onClick={() => setCollapsedProjects((prev) => {
                        const next = new Set(prev);
                        next.has(sectionKey) ? next.delete(sectionKey) : next.add(sectionKey);
                        return next;
                      })}
                    >
                      <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </span>
                      {projectId ? (
                        <Link
                          href={`/clients/${selectedGroup.clientId}/projects/${projectId}/tasks`}
                          className="font-medium text-sm truncate hover:underline"
                          style={{ color: "var(--text-primary)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {projectName}
                        </Link>
                      ) : (
                        <span className="font-medium text-sm" style={{ color: "var(--text-muted)" }}>
                          {projectName}
                        </span>
                      )}
                      <span
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium tabular-nums ml-auto"
                        style={{ background: "var(--border)", color: "var(--text-muted)" }}
                      >
                        {tasks.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="px-2 pb-2">
                        {tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            subtasks={activeData.subtasksByParent[task.id] ?? []}
                            isExpanded={expandedTasks.has(task.id)}
                            onToggleExpand={() => setExpandedTasks((prev) => {
                              const next = new Set(prev);
                              next.has(task.id) ? next.delete(task.id) : next.add(task.id);
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
                            today={today}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
