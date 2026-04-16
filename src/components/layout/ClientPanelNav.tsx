"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Settings, Briefcase, Sheet, BookOpen, Activity, ChevronRight, ChevronDown, LayoutDashboard, CalendarDays, CheckSquare, Dna } from "lucide-react";
import type { Client, Project, Sheet as SheetType } from "@/types";

const tabItems = [
  { tab: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { tab: "tasks", label: "Tasks", icon: CheckSquare },
  { tab: "projects", label: "Projects", icon: Briefcase },
  { tab: "content", label: "Content", icon: Dna },
  { tab: "divider-1" },
  { tab: "sheets", label: "Sheets", icon: Sheet },
  { tab: "divider-2" },
  { tab: "events", label: "Events", icon: CalendarDays },
  { tab: "logbook", label: "Logbook", icon: BookOpen },
  { tab: "activity", label: "Activity", icon: Activity },
  { tab: "divider-3" },
  { tab: "settings", label: "Settings", icon: Settings },
] as const;

const validTabs: string[] = tabItems.filter((t) => !t.tab.startsWith("divider")).map((t) => t.tab);

export default function ClientPanelNav({
  client,
  projects = [],
  sheets = [],
}: {
  client: Client;
  projects?: Pick<Project, "id" | "title" | "status">[];
  sheets?: Pick<SheetType, "id" | "name">[];
}) {
  const pathname = usePathname();
  const [localSheets, setLocalSheets] = useState(sheets);
  const [showCompleted, setShowCompleted] = useState(false);

  // Track active tab locally (updated via URL reads and tab-change events)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab")?.toLowerCase() ?? "dashboard";
      return validTabs.includes(tab) ? tab : "dashboard";
    }
    return "dashboard";
  });

  useEffect(() => {
    function fetchSheets() {
      fetch(`/api/clients/${client.id}/sheets`)
        .then((r) => r.json())
        .then((data: SheetType[]) =>
          setLocalSheets(data.map((s) => ({ id: s.id, name: s.name })))
        );
    }

    fetchSheets();

    function handleSheetsUpdated(e: Event) {
      const { clientId } = (e as CustomEvent).detail ?? {};
      if (clientId !== client.id) return;
      fetchSheets();
    }
    window.addEventListener("sheets-updated", handleSheetsUpdated);
    return () => window.removeEventListener("sheets-updated", handleSheetsUpdated);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for tab-change events to keep active state in sync
  useEffect(() => {
    function handleTabChange(e: Event) {
      const { tab } = (e as CustomEvent).detail ?? {};
      if (tab && validTabs.includes(tab)) setActiveTab(tab);
    }
    window.addEventListener("tab-change", handleTabChange);
    return () => window.removeEventListener("tab-change", handleTabChange);
  }, []);

  const isOnProjectDetail = !!pathname.match(new RegExp(`/clients/${client.id}/projects/[^/]+`));
  const isOnProjectsArea = activeTab === "projects" || isOnProjectDetail;

  const isOnSheetDetail = !!pathname.match(new RegExp(`/clients/${client.id}/sheets/[^/]+`));
  const isOnSheetsArea = activeTab === "sheets" || isOnSheetDetail;

  // Detect active project id from pathname
  const projectDetailMatch = pathname.match(
    new RegExp(`/clients/${client.id}/projects/([^/]+)`)
  );
  const activeProjectId = projectDetailMatch?.[1] ?? null;

  // Detect active sheet id from pathname
  const sheetDetailMatch = pathname.match(
    new RegExp(`/clients/${client.id}/sheets/([^/]+)`)
  );
  const activeSheetId = sheetDetailMatch?.[1] ?? null;

  const isOnClientRoot = pathname === `/clients/${client.id}`;

  function handleTabClick(e: React.MouseEvent, tab: string) {
    // Only intercept when on client root — on sub-routes (e.g. /clients/[id]/projects/[pid]),
    // let the <Link> navigate normally back to the client page
    if (!isOnClientRoot) return;
    e.preventDefault();
    setActiveTab(tab);
    window.history.replaceState(null, "", `/clients/${client.id}?tab=${tab}`);
    window.dispatchEvent(new CustomEvent("tab-change", { detail: { tab } }));
  }

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Company name header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {client.company}
        </span>
      </div>

      {/* Tab nav */}
      <div className="px-2 space-y-0.5">
        {tabItems.map((item) => {
          if (item.tab.startsWith("divider")) {
            return (
              <div
                key={item.tab}
                className="my-1.5 mx-2"
                style={{ borderTop: "1px solid var(--border)" }}
              />
            );
          }

          const { tab, label, icon: Icon } = item as { tab: string; label: string; icon: React.ElementType };
          const active = tab === "projects"
            ? activeTab === "projects" && !isOnProjectDetail
            : tab === "sheets"
            ? activeTab === "sheets" && !isOnSheetDetail
            : activeTab === tab && !isOnProjectsArea && !isOnSheetDetail;
          const isProjects = tab === "projects";
          const isSheets = tab === "sheets";

          return (
            <div key={tab}>
              <Link
                href={`/clients/${client.id}?tab=${tab}`}
                onClick={(e) => handleTabClick(e, tab)}
                data-active={active}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
              >
                <Icon size={14} strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {isProjects && projects.length > 0 && (
                  <ChevronRight
                    size={12}
                    strokeWidth={2}
                    className="transition-transform"
                    style={{
                      transform: isOnProjectsArea ? "rotate(90deg)" : "rotate(0deg)",
                      color: "var(--text-muted)",
                    }}
                  />
                )}
                {isSheets && localSheets.length > 0 && (
                  <ChevronRight
                    size={12}
                    strokeWidth={2}
                    className="transition-transform"
                    style={{
                      transform: isOnSheetsArea ? "rotate(90deg)" : "rotate(0deg)",
                      color: "var(--text-muted)",
                    }}
                  />
                )}
              </Link>

              {/* Project children — shown when in projects area */}
              {isProjects && isOnProjectsArea && projects.length > 0 && (() => {
                const activeProjects = projects.filter((p) => p.status !== "completed");
                const completedProjects = projects.filter((p) => p.status === "completed");
                const visibleProjects = showCompleted ? projects : activeProjects;
                return (
                  <div className="mt-0.5 space-y-0.5">
                    {visibleProjects.map((project) => {
                      const projectActive = activeProjectId === project.id;
                      return (
                        <Link
                          key={project.id}
                          href={`/clients/${client.id}/projects/${project.id}/tasks`}
                          data-active={projectActive}
                          className="flex items-center gap-2 pl-4 pr-2 py-1.5 ml-4 rounded-lg text-sm transition-colors nav-panel-item truncate"
                        >
                          <span className="truncate">{project.title}</span>
                        </Link>
                      );
                    })}
                    {completedProjects.length > 0 && (
                      <button
                        onClick={() => setShowCompleted((v) => !v)}
                        className="flex items-center gap-1.5 pl-4 pr-2 py-1 ml-4 rounded-md text-xs transition-colors cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <ChevronDown
                          size={11}
                          strokeWidth={2}
                          className="transition-transform shrink-0"
                          style={{ transform: showCompleted ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                        <span>{showCompleted ? "Hide completed" : `${completedProjects.length} completed`}</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Sheet children — shown when in sheets area */}
              {isSheets && isOnSheetsArea && localSheets.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {localSheets.map((sheet) => {
                    const sheetActive = activeSheetId === sheet.id;
                    return (
                      <Link
                        key={sheet.id}
                        href={`/clients/${client.id}/sheets/${sheet.id}`}
                        data-active={sheetActive}
                        className="flex items-center gap-2 pl-4 pr-2 py-1.5 ml-4 rounded-lg text-sm transition-colors nav-panel-item truncate"
                      >
                        <span className="truncate">{sheet.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </aside>
  );
}
