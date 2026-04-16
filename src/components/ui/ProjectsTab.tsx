"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ProjectsTimeline from "@/components/ui/ProjectsTimeline";
import { ProjectsSkeleton } from "@/components/ui/TabSkeletons";
import { fmtDate } from "@/lib/utils";
import type { Project } from "@/types";

interface ProjectStats {
  projects: Project[];
  perProject: Record<string, { total: number; completed: number }>;
  overduePerProject: Record<string, number>;
  openTaskCounts: Record<string, number>;
}

export default function ProjectsTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/projects/stats`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading || !data) return <ProjectsSkeleton />;

  const { projects, perProject, overduePerProject, openTaskCounts } = data;

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No projects yet. Click &ldquo;Add Project&rdquo; to get started.</p>
      </div>
    );
  }

  const upcomingProjects = projects.filter((p) => !p.kickedOffAt);
  const inProgress = projects.filter((p) => p.kickedOffAt && p.status === "in_progress");
  const notStarted = projects.filter((p) => p.kickedOffAt && p.status === "not_started");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="space-y-8">
      {(inProgress.length > 0 || upcomingProjects.length > 0 || notStarted.length > 0) && (
        <ProjectsTimeline projects={projects} clientId={clientId} openTaskCounts={openTaskCounts} />
      )}

      {inProgress.length > 0 && (
        <ProjectSection title="Currently" projects={inProgress} clientId={clientId} perProject={perProject} overduePerProject={overduePerProject} />
      )}

      {upcomingProjects.length > 0 && (
        <ProjectSection title="Upcoming" projects={upcomingProjects} clientId={clientId} perProject={perProject} overduePerProject={overduePerProject} />
      )}

      {notStarted.length > 0 && (
        <ProjectSection title="Not Started" projects={notStarted} clientId={clientId} perProject={perProject} overduePerProject={overduePerProject} />
      )}

      {completed.length > 0 && (
        <CompletedSection projects={completed} clientId={clientId} />
      )}
    </div>
  );
}

function ProjectSection({
  title,
  projects,
  clientId,
  perProject,
  overduePerProject,
}: {
  title: string;
  projects: Project[];
  clientId: string;
  perProject: Record<string, { total: number; completed: number }>;
  overduePerProject: Record<string, number>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} clientId={clientId} stats={perProject[p.id]} overdue={overduePerProject[p.id] ?? 0} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  clientId,
  stats,
  overdue = 0,
}: {
  project: Project;
  clientId: string;
  stats?: { total: number; completed: number };
  overdue?: number;
}) {
  const openTasks = stats ? stats.total - stats.completed : null;
  const pct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : null;

  return (
    <Link
      href={`/clients/${clientId}/projects/${project.id}/tasks`}
      className="relative flex flex-col rounded-xl border p-4 bg-white dark:bg-[var(--bg-sidebar)] transition-colors project-card-hover"
      style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
    >
      {!project.kickedOffAt && (
        <span
          className="absolute top-3 right-3 typo-tag px-1.5 py-0.5 rounded-full"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          Upcoming
        </span>
      )}

      <div className="flex gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)" }}
        >
          <FolderOpen size={15} style={{ color: "var(--text-muted)" }} />
        </div>
        <div className="flex flex-col justify-center min-w-0">
          {project.service && (
            <p className="typo-tag leading-none mb-1 truncate" style={{ color: "var(--text-muted)" }}>
              {project.service}
            </p>
          )}
          <p className="font-medium text-sm leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
            {project.title}
          </p>
        </div>
      </div>

      {project.description && (
        <p
          className="text-xs leading-relaxed mt-3 line-clamp-3"
          style={{ color: "var(--text-muted)" }}
        >
          {project.description}
        </p>
      )}

      <div className="flex-1 min-h-[1.25rem]" />

      {(openTasks !== null || (stats && stats.total > 0)) && (
        <div className="flex flex-col gap-1.5 mt-5">
          {openTasks !== null && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {openTasks} open {openTasks === 1 ? "task" : "tasks"}
              {overdue > 0 && (
                <span style={{ color: "var(--danger)" }}> · {overdue} overdue</span>
              )}
            </p>
          )}
          {stats && stats.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
              </div>
              <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                {stats.completed}/{stats.total}
              </span>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function CompletedSection({
  projects,
  clientId,
}: {
  projects: Project[];
  clientId: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
        Completed
      </h3>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="grid grid-cols-4 px-4 py-2.5 text-xs font-medium" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <span>Project</span>
          <span>Created</span>
          <span>Completed</span>
          <span>Status</span>
        </div>
        {projects.map((project, idx) => (
          <Link
            key={project.id}
            href={`/clients/${clientId}/projects/${project.id}/tasks`}
            className="grid grid-cols-4 items-center px-4 py-3 text-sm hover:bg-[var(--bg-hover)] transition-colors"
            style={idx < projects.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
          >
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{project.title}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(project.createdAt)}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(project.completedDate)}</span>
            <span><StatusBadge status={project.status} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
