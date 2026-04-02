"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, CheckSquare, FolderKanban, UserPlus, Building2, Trash2, CheckCheck, ChevronDown, ChevronRight, CalendarDays, Rocket } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";

export interface ActivityEvent {
  id: string;
  clientId: string;
  actorId: string;
  actorName: string;
  actorImage: string | null;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

function firstName(actorName: string): string {
  return actorName.trim().split(/\s+/)[0];
}

function Bold({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{children}</span>;
}

function Italic({ children }: { children: React.ReactNode }) {
  return <em className="not-italic font-medium" style={{ color: "var(--text-primary)" }}>{children}</em>;
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ opacity: 0.65 }}>{children}</span>;
}

function eventDescription(event: ActivityEvent): React.ReactNode {
  const { type, metadata } = event;
  const title = metadata.title as string | undefined;
  const status = metadata.status as string | undefined;
  const added = metadata.added as string[] | undefined;
  const removed = metadata.removed as string[] | undefined;
  const followUp = metadata.followUp as boolean | undefined;
  const followUpAction = metadata.followUpAction as string | undefined;

  switch (type) {
    case "log.created":
      return followUp
        ? <><Dim>New </Dim><Bold>log</Bold><Dim> added, follow up later</Dim></>
        : <><Dim>New </Dim><Bold>log</Bold><Dim> added</Dim></>;
    case "log.updated":
      return <Dim>Log updated</Dim>;
    case "log.deleted":
      return <><Bold>Log</Bold><Dim> deleted</Dim></>;
    case "log.followedup":
      return followUpAction
        ? <><Italic>{followUpAction}</Italic><Dim> marked as done</Dim></>
        : <Dim>Follow-up marked as done</Dim>;
    case "task.created":
      return title
        ? <><Dim>New </Dim><Bold>task</Bold><Dim> added: </Dim><Italic>{title}</Italic></>
        : <><Dim>New </Dim><Bold>task</Bold><Dim> added</Dim></>;
    case "task.completed":
      return title
        ? <><Bold>Task</Bold><Dim> completed: </Dim><Italic>{title}</Italic></>
        : <><Bold>Task</Bold><Dim> completed</Dim></>;
    case "task.deleted":
      return title
        ? <><Bold>Task</Bold><Dim> deleted: </Dim><Italic>{title}</Italic></>
        : <><Bold>Task</Bold><Dim> deleted</Dim></>;
    case "project.created":
      return title
        ? <><Dim>New </Dim><Bold>project</Bold><Dim> added: </Dim><Italic>{title}</Italic></>
        : <><Dim>New </Dim><Bold>project</Bold><Dim> added</Dim></>;
    case "project.status_changed":
      return title && status
        ? <><Bold>Project</Bold><Dim> moved to </Dim><Italic>{STATUS_LABELS[status] ?? status}</Italic><Dim>: </Dim><Italic>{title}</Italic></>
        : <><Bold>Project</Bold><Dim> status updated</Dim></>;
    case "project.kicked_off":
      return title
        ? <><Bold>Project</Bold><Dim> kicked off: </Dim><Italic>{title}</Italic></>
        : <><Bold>Project</Bold><Dim> kicked off</Dim></>;
    case "project.reset_to_upcoming":
      return title
        ? <><Bold>Project</Bold><Dim> reset to upcoming: </Dim><Italic>{title}</Italic></>
        : <><Bold>Project</Bold><Dim> reset to upcoming</Dim></>;
    case "project.deleted":
      return title
        ? <><Bold>Project</Bold><Dim> deleted: </Dim><Italic>{title}</Italic></>
        : <><Bold>Project</Bold><Dim> deleted</Dim></>;
    case "contact.changed": {
      const parts: string[] = [];
      if (added && added.length > 0) parts.push(`added ${added.join(", ")}`);
      if (removed && removed.length > 0) parts.push(`removed ${removed.join(", ")}`);
      return parts.length > 0
        ? <><Dim>Contacts updated: {parts.join(" and ")}</Dim></>
        : <Dim>Contacts updated</Dim>;
    }
    case "client.updated":
      return <Dim>Company details updated</Dim>;
    case "event.created":
      return title
        ? <><Dim>New </Dim><Bold>event</Bold><Dim> added: </Dim><Italic>{title}</Italic></>
        : <><Dim>New </Dim><Bold>event</Bold><Dim> added</Dim></>;
    case "event.updated":
      return title
        ? <><Bold>Event</Bold><Dim> updated: </Dim><Italic>{title}</Italic></>
        : <><Bold>Event</Bold><Dim> updated</Dim></>;
    case "event.deleted":
      return title
        ? <><Bold>Event</Bold><Dim> deleted: </Dim><Italic>{title}</Italic></>
        : <><Bold>Event</Bold><Dim> deleted</Dim></>;
    default:
      return <Dim>Activity recorded</Dim>;
  }
}

function typeSummaryLabel(type: string, count: number): React.ReactNode {
  const n = count;
  const s = n > 1 ? "s" : "";
  switch (type) {
    case "task.created":           return <><Bold>{n} task{s}</Bold><Dim> added</Dim></>;
    case "task.completed":         return <><Bold>{n} task{s}</Bold><Dim> completed</Dim></>;
    case "task.deleted":           return <><Bold>{n} task{s}</Bold><Dim> deleted</Dim></>;
    case "project.created":           return <><Bold>{n} project{s}</Bold><Dim> added</Dim></>;
    case "project.status_changed":    return <><Bold>{n}</Bold><Dim> project status change{s}</Dim></>;
    case "project.kicked_off":        return <><Bold>{n} project{s}</Bold><Dim> kicked off</Dim></>;
    case "project.reset_to_upcoming": return <><Bold>{n} project{s}</Bold><Dim> reset to upcoming</Dim></>;
    case "project.deleted":           return <><Bold>{n} project{s}</Bold><Dim> deleted</Dim></>;
    case "log.created":            return <><Bold>{n} log{s}</Bold><Dim> added</Dim></>;
    case "log.updated":            return <><Bold>{n} log{s}</Bold><Dim> updated</Dim></>;
    case "log.deleted":            return <><Bold>{n} log{s}</Bold><Dim> deleted</Dim></>;
    case "log.followedup":         return <><Bold>{n}</Bold><Dim> follow-up{s} completed</Dim></>;
    case "contact.changed":        return <><Bold>{n}</Bold><Dim> contact change{s}</Dim></>;
    case "client.updated":         return <><Bold>{n}</Bold><Dim> company update{s}</Dim></>;
    case "event.created":          return <><Bold>{n} event{s}</Bold><Dim> added</Dim></>;
    case "event.updated":          return <><Bold>{n} event{s}</Bold><Dim> updated</Dim></>;
    case "event.deleted":          return <><Bold>{n} event{s}</Bold><Dim> deleted</Dim></>;
    default:                       return <><Bold>{n}</Bold><Dim> activit{n > 1 ? "ies" : "y"}</Dim></>;
  }
}

function eventIcon(type: string) {
  if (type === "log.deleted" || type === "task.deleted" || type === "project.deleted") return <Trash2 size={14} />;
  if (type === "log.followedup") return <CheckCheck size={14} />;
  if (type === "project.kicked_off") return <Rocket size={14} />;
  if (type.startsWith("log.")) return <NotebookPen size={14} />;
  if (type.startsWith("task.")) return <CheckSquare size={14} />;
  if (type.startsWith("project.")) return <FolderKanban size={14} />;
  if (type.startsWith("contact.")) return <UserPlus size={14} />;
  if (type.startsWith("client.")) return <Building2 size={14} />;
  if (type.startsWith("event.")) return <CalendarDays size={14} />;
  return <Building2 size={14} />;
}

function eventIconBg(type: string): string {
  if (type === "log.deleted" || type === "task.deleted" || type === "project.deleted") {
    return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  }
  if (type.startsWith("log.")) return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
  if (type.startsWith("task.")) return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
  if (type.startsWith("project.")) return "bg-[var(--primary-light)] text-[var(--primary)]";
  if (type.startsWith("contact.")) return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";
  if (type.startsWith("event.")) return "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function getPeriodKey(isoString: string, now: Date): string {
  const diffH = (now.getTime() - new Date(isoString).getTime()) / 3600000;
  if (diffH < 24) return "last-24h";
  if (diffH < 168) return "this-week";
  if (diffH < 720) return "this-month";
  const d = new Date(isoString);
  return `m-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getPeriodLabel(isoString: string, now: Date): string {
  const diffH = (now.getTime() - new Date(isoString).getTime()) / 3600000;
  if (diffH < 24) return "Last 24 hours";
  if (diffH < 168) return "This week";
  if (diffH < 720) return "This month";
  return new Date(isoString).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function eventNavUrl(clientId: string, event: ActivityEvent): string | null {
  const { type, metadata } = event;
  const projectId = metadata.projectId as string | undefined;

  if (type.startsWith("task.") && projectId) {
    return `/clients/${clientId}/projects/${projectId}/tasks`;
  }
  if (type.startsWith("project.") && projectId) {
    return `/clients/${clientId}/projects/${projectId}`;
  }
  if (type.startsWith("log.")) {
    return `/clients/${clientId}?tab=Logbook`;
  }
  if (type === "contact.changed" || type === "client.updated") {
    return `/clients/${clientId}`;
  }
  if (type.startsWith("event.")) {
    return `/clients/${clientId}?tab=Events`;
  }
  return null;
}

export function CollapsibleTypeGroup({ events, type, clientId }: { events: ActivityEvent[]; type: string; clientId: string }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const uniqueActors = useMemo(() => {
    const seen = new Set<string>();
    return events.filter((e) => {
      if (seen.has(e.actorId)) return false;
      seen.add(e.actorId);
      return true;
    });
  }, [events]);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-3 px-2 text-left rounded transition-colors cursor-pointer hover:bg-[var(--primary-light)]"
      >
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${eventIconBg(type)}`}>
          {eventIcon(type)}
        </div>
        <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
          {typeSummaryLabel(type, events.length)}
        </p>
        <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {!expanded && (
          <>
            <div className="flex-1" />
            <div className="flex items-center" style={{ gap: "-4px" }}>
              {uniqueActors.slice(0, 5).map((e, i) => (
                <div key={e.actorId} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: uniqueActors.length - i, position: "relative" }}>
                  <UserAvatar name={e.actorName} image={e.actorImage} size={20} />
                </div>
              ))}
              {uniqueActors.length > 5 && (
                <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>+{uniqueActors.length - 5}</span>
              )}
            </div>
          </>
        )}
      </button>

      {expanded && (
        <div className="divide-y">
          {events.map((event) => {
            const url = eventNavUrl(clientId, event);
            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 py-2 pl-16 pr-2 rounded ${url ? "cursor-pointer hover:bg-[var(--primary-light)]" : ""}`}
                onClick={url ? () => router.push(url) : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
                    {eventDescription(event)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {timeAgo(event.createdAt)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {firstName(event.actorName)}
                  </span>
                  <UserAvatar name={event.actorName} image={event.actorImage} size={20} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 w-6 h-6 rounded-full animate-pulse" style={{ background: "var(--border)" }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 rounded animate-pulse w-3/4" style={{ background: "var(--border)" }} />
        <div className="h-3 rounded animate-pulse w-1/4" style={{ background: "var(--border)" }} />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-full animate-pulse" style={{ background: "var(--border)" }} />
        <div className="h-3 rounded animate-pulse w-10" style={{ background: "var(--border)" }} />
      </div>
    </div>
  );
}

export default function ActivityTab({ clientId }: { clientId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/activity`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const periodGroups = useMemo(() => {
    const now = new Date();
    const periodMap = new Map<string, { label: string; typeMap: Map<string, ActivityEvent[]> }>();
    const periodOrder: string[] = [];

    for (const event of events) {
      const key = getPeriodKey(event.createdAt, now);
      const label = getPeriodLabel(event.createdAt, now);

      if (!periodMap.has(key)) {
        periodMap.set(key, { label, typeMap: new Map() });
        periodOrder.push(key);
      }

      const period = periodMap.get(key)!;
      if (!period.typeMap.has(event.type)) {
        period.typeMap.set(event.type, []);
      }
      period.typeMap.get(event.type)!.push(event);
    }

    return periodOrder.map((key) => {
      const { label, typeMap } = periodMap.get(key)!;
      return {
        key,
        label,
        typeGroups: Array.from(typeMap.entries()).map(([type, evts]) => ({ type, events: evts })),
      };
    });
  }, [events]);

  if (loading) {
    return (
      <div className="max-w-2xl divide-y" style={{ borderColor: "var(--border)" }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {periodGroups.map((period) => (
        <div key={period.key}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            {period.label}
          </p>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {period.typeGroups.map(({ type, events: typeEvents }) => (
              <CollapsibleTypeGroup key={type} type={type} events={typeEvents} clientId={clientId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
