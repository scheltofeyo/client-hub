"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import ProjectEditor from "@/components/ui/editor-panel/ProjectEditor";
import type { Project, ProjectLabel, ProjectRole, Service } from "@/types";

type AssignableUser = { id: string; name: string; image: string | null };

/**
 * Overview "Edit" action. Opens the renewed in-RightPanel ProjectEditor (the
 * same shell used for plan draft projects) instead of the old SteppedModal form.
 * Role + user lookups (needed by the Budget tab and member picker) are fetched
 * lazily on first open and cached.
 */
export default function EditProjectButton({
  project,
  clientId,
  services,
  labels,
  canDelete = false,
  canReset = false,
}: {
  project: Project;
  clientId: string;
  services: Service[];
  labels: ProjectLabel[];
  canDelete?: boolean;
  canReset?: boolean;
}) {
  const { openPanel, closePanel } = useRightPanel();
  const [loading, setLoading] = useState(false);
  const rolesRef = useRef<ProjectRole[] | null>(null);
  const usersRef = useRef<AssignableUser[] | null>(null);

  async function handleOpen() {
    setLoading(true);
    try {
      if (!rolesRef.current || !usersRef.current) {
        const [roles, users] = await Promise.all([
          fetch("/api/project-roles").then((r) => r.json()).catch(() => []),
          fetch("/api/users/assignable").then((r) => r.json()).catch(() => []),
        ]);
        rolesRef.current = Array.isArray(roles) ? roles : [];
        usersRef.current = Array.isArray(users) ? users : [];
      }
      openPanel(
        "Edit project",
        <ProjectEditor
          project={project}
          clientId={clientId}
          services={services}
          labels={labels}
          projectRoles={rolesRef.current}
          assignableUsers={usersRef.current}
          canDelete={canDelete}
          canReset={canReset}
          onClose={closePanel}
        />,
        { padded: false }
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-border disabled:opacity-50"
    >
      <Pencil size={13} />
      Edit
    </button>
  );
}
