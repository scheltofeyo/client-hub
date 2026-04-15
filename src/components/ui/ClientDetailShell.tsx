"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import FolderPendingBanner from "@/components/ui/FolderPendingBanner";
import ScrollReset from "@/components/ui/ScrollReset";
import AboutTertiaryNav from "@/components/layout/AboutTertiaryNav";

// Tab components
import OverviewTab from "@/components/ui/OverviewTab";
import ProjectsTab from "@/components/ui/ProjectsTab";
import ClientTasksTab, { AddClientTaskButton } from "@/components/ui/ClientTasksTab";
import SheetsTab, { ManageSheetsButton } from "@/components/ui/SheetsTab";
import LogbookTab from "@/components/ui/LogbookTab";
import EventsTab from "@/components/ui/EventsTab";
import ActivityTab from "@/components/ui/ActivityTab";
import SettingsTab from "@/components/ui/SettingsTab";
import AddProjectButton from "@/components/ui/AddProjectButton";
import AddEventButton from "@/components/ui/AddEventButton";

// Skeletons
import { DashboardSkeleton, TasksSkeleton, LogbookSkeleton, SheetsSkeleton } from "@/components/ui/TabSkeletons";

import type { Client, ProjectStatus, Task, Sheet, TimelineEvent } from "@/types";

const tabs = ["Dashboard", "Projects", "Tasks", "Sheets", "Logbook", "Events", "Activity", "Settings"] as const;
type Tab = (typeof tabs)[number];

interface ClientDetailShellProps {
  client: Client;
  clientId: string;
  permissions: string[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  canEdit: boolean;
  canAssignLeads: boolean;
  allUsers: { id: string; name: string; email: string; image: string | null }[];
  initialTab: Tab;
  initialSection: string;
}

// Module-level data cache for tab data
const dataCache = new Map<string, unknown>();

export default function ClientDetailShell({
  client,
  clientId,
  permissions,
  currentUserId,
  currentUserName,
  isAdmin,
  canEdit,
  canAssignLeads,
  allUsers,
  initialTab,
  initialSection,
}: ClientDetailShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [section, setSection] = useState(initialSection);

  type TasksState = { generalTasks: Task[]; projectTasks: Record<string, Task[]>; projects: { id: string; title: string; status: ProjectStatus; kickedOffAt?: string }[] };
  type LogbookState = { logs: unknown[]; signals: unknown[]; contacts: unknown[] };
  type EventsState = { events: TimelineEvent[]; eventTypes: unknown[] };

  // Tab data state — triggers re-render when fetch completes
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null);
  const [tasksData, setTasksData] = useState<TasksState | null>(null);
  const [logbookData, setLogbookData] = useState<LogbookState | null>(null);
  const [sheetsData, setSheetsData] = useState<Sheet[] | null>(null);
  const [eventsData, setEventsData] = useState<EventsState | null>(null);

  // ── Listen for tab-change events from ClientPanelNav ──
  useEffect(() => {
    function handleTabChange(e: Event) {
      const { tab } = (e as CustomEvent).detail ?? {};
      const matched = tabs.find((t) => t.toLowerCase() === tab?.toLowerCase());
      if (matched) {
        setActiveTab(matched);
        if (matched !== "Settings") setSection("about");
      }
    }
    function handleSectionChange(e: Event) {
      const { section: sec } = (e as CustomEvent).detail ?? {};
      if (sec) setSection(sec);
    }
    window.addEventListener("tab-change", handleTabChange);
    window.addEventListener("section-change", handleSectionChange);
    return () => {
      window.removeEventListener("tab-change", handleTabChange);
      window.removeEventListener("section-change", handleSectionChange);
    };
  }, []);

  // ── Sync URL when tab changes ──
  useEffect(() => {
    const url = activeTab === "Settings" && section !== "about"
      ? `/clients/${clientId}?tab=${activeTab.toLowerCase()}&section=${section}`
      : `/clients/${clientId}?tab=${activeTab.toLowerCase()}`;
    window.history.replaceState(null, "", url);
  }, [activeTab, section, clientId]);

  // ── Respond to browser back/forward ──
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab")?.toLowerCase() ?? "dashboard";
      const matched = tabs.find((t) => t.toLowerCase() === tab);
      if (matched) setActiveTab(matched);
      setSection(params.get("section") ?? "about");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── Fetch data for active tab on first visit ──
  useEffect(() => {
    const cacheKey = `${clientId}:${activeTab}`;

    // Already cached — skip fetch
    if (dataCache.has(cacheKey)) return;

    // Each tab has its own state, so it's safe to let fetches complete
    // even if the user switches away — data is cached for when they return
    async function fetchTabData() {
      try {
        switch (activeTab) {
          case "Dashboard": {
            const data = await fetch(`/api/clients/${clientId}/dashboard`).then((r) => r.json());
            dataCache.set(cacheKey, data);
            setDashboardData(data);
            break;
          }
          case "Tasks": {
            const [projects, generalTasks] = await Promise.all([
              fetch(`/api/clients/${clientId}/projects`).then((r) => r.json()),
              fetch(`/api/clients/${clientId}/tasks`).then((r) => r.json()),
            ]);
            const projectIds = (projects as { id: string }[]).map((p) => p.id);
            const projectTasks: Record<string, Task[]> = {};
            if (projectIds.length > 0) {
              const results = await Promise.all(
                projectIds.map((pid) =>
                  fetch(`/api/clients/${clientId}/projects/${pid}/tasks`)
                    .then((r) => r.json())
                    .then((tasks) => [pid, tasks] as const)
                )
              );
              for (const [pid, tasks] of results) projectTasks[pid] = tasks;
            }
            const result = { generalTasks, projectTasks, projects };
            dataCache.set(cacheKey, result);
            setTasksData(result);
            break;
          }
          case "Logbook": {
            const [logs, signals] = await Promise.all([
              fetch(`/api/clients/${clientId}/logs`).then((r) => r.json()),
              fetch("/api/log-signals").then((r) => r.json()),
            ]);
            const result = { logs, signals, contacts: client.contacts ?? [] };
            dataCache.set(cacheKey, result);
            setLogbookData(result);
            break;
          }
          case "Sheets": {
            const data = await fetch(`/api/clients/${clientId}/sheets`).then((r) => r.json());
            dataCache.set(cacheKey, data);
            setSheetsData(data);
            break;
          }
          case "Events": {
            const [events, eventTypes] = await Promise.all([
              fetch(`/api/clients/${clientId}/events`).then((r) => r.json()),
              fetch("/api/event-types").then((r) => r.json()),
            ]);
            const result = { events, eventTypes };
            dataCache.set(cacheKey, result);
            setEventsData(result);
            break;
          }
          // Projects, Activity, Settings handle their own fetching
        }
      } catch {
        // fetch failed — skeleton stays visible, retry on next tab switch
      }
    }

    fetchTabData();
  }, [activeTab, clientId, client.contacts]);

  // Resolve data: prefer state (updated by fetch), fall back to cache
  const rDashboard = dashboardData ?? (dataCache.get(`${clientId}:Dashboard`) as Record<string, unknown> | undefined) ?? null;
  const rTasks = tasksData ?? (dataCache.get(`${clientId}:Tasks`) as TasksState | undefined) ?? null;
  const rLogbook = logbookData ?? (dataCache.get(`${clientId}:Logbook`) as LogbookState | undefined) ?? null;
  const rSheets = sheetsData ?? (dataCache.get(`${clientId}:Sheets`) as Sheet[] | undefined) ?? null;
  const rEvents = eventsData ?? (dataCache.get(`${clientId}:Events`) as EventsState | undefined) ?? null;

  // ── Action buttons per tab ──
  const actions = (() => {
    if (activeTab === "Projects" && canEdit && permissions.includes("projects.create")) {
      return <AddProjectButton clientId={clientId} />;
    }
    if (activeTab === "Tasks" && permissions.includes("tasks.create")) {
      return <AddClientTaskButton clientId={clientId} />;
    }
    if (activeTab === "Sheets" && permissions.includes("sheets.create")) {
      return <ManageSheetsButton clientId={clientId} initialSheets={rSheets ?? []} />;
    }
    if (activeTab === "Events" && permissions.includes("events.create")) {
      return <AddEventButton clientId={clientId} />;
    }
    return undefined;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.company, href: `/clients/${clientId}` },
          { label: "..." },
        ]}
        title={activeTab}
        actions={actions}
        tertiaryNav={
          activeTab === "Settings" ? (
            <AboutTertiaryNav clientId={clientId} />
          ) : undefined
        }
      />

      {client.folderStatus === "pending" && (
        <FolderPendingBanner clientId={clientId} />
      )}

      <div
        className={`flex-1 overflow-y-auto px-7 pb-7 ${activeTab === "Dashboard" ? "pt-0" : "pt-7"}`}
        style={activeTab === "Dashboard" ? { background: "var(--bg-surface)" } : undefined}
      >
        <ScrollReset activeTab={activeTab} />

        {activeTab === "Dashboard" && (
          !rDashboard ? (
            <DashboardSkeleton />
          ) : (
            <OverviewTab
              clientId={clientId}
              client={rDashboard.client as Client}
              projects={rDashboard.projects as typeof client.projects & unknown[]}
              signals={rDashboard.logSignals as never[]}
              sheets={rDashboard.sheets as Sheet[]}
              services={rDashboard.services as never[]}
              contacts={client.contacts ?? []}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              totalOpenTasks={rDashboard.totalOpenTasks as number}
              overdueTaskCount={rDashboard.overdueTaskCount as number}
              myOpenTasks={rDashboard.myOpenTasks as number}
              initialEvents={(rDashboard.upcomingEvents as TimelineEvent[]).slice(0, 2)}
              eventTypes={rDashboard.eventTypes as never[]}
              statusOptions={rDashboard.clientStatuses as never[]}
              lastActivityAt={rDashboard.lastActivityAt as string | null}
              serviceFollowUpDates={rDashboard.serviceFollowUpDates as Record<string, string>}
            />
          )
        )}

        {activeTab === "Projects" && (
          <ProjectsTab clientId={clientId} />
        )}

        {activeTab === "Tasks" && (
          !rTasks ? (
            <TasksSkeleton />
          ) : (
            <ClientTasksTab
              clientId={clientId}
              projects={rTasks.projects.map((p) => ({ id: p.id, title: p.title, status: p.status, kickedOffAt: p.kickedOffAt }))}
              initialGeneralTasks={rTasks.generalTasks}
              initialProjectTasks={rTasks.projectTasks}
              currentUserId={currentUserId}
              today={new Date().toISOString().slice(0, 10)}
              canEditOwnTask={permissions.includes("tasks.editOwn")}
              canEditAnyTask={permissions.includes("tasks.editAny")}
              canDeleteOwnTask={permissions.includes("tasks.deleteOwn")}
              canDeleteAnyTask={permissions.includes("tasks.deleteAny")}
            />
          )
        )}

        {activeTab === "Sheets" && (
          !rSheets ? (
            <SheetsSkeleton />
          ) : (
            <SheetsTab clientId={clientId} initialSheets={rSheets} />
          )
        )}

        {activeTab === "Logbook" && (
          !rLogbook ? (
            <LogbookSkeleton />
          ) : (
            <LogbookTab
              clientId={clientId}
              clientName={client.company}
              initialLogs={rLogbook.logs as never[]}
              signals={rLogbook.signals as never[]}
              contacts={rLogbook.contacts as never[]}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              canCreateLog={permissions.includes("logs.create")}
              canEditAnyLog={permissions.includes("logs.editAny")}
              canDeleteAnyLog={permissions.includes("logs.deleteAny")}
            />
          )
        )}

        {activeTab === "Events" && (
          !rEvents ? (
            <TasksSkeleton />
          ) : (
            <EventsTab
              clientId={clientId}
              initialEvents={rEvents.events}
              initialEventTypes={rEvents.eventTypes as never[]}
            />
          )
        )}

        {activeTab === "Activity" && (
          <ActivityTab clientId={clientId} />
        )}

        {activeTab === "Settings" && (
          <SettingsTab
            client={client}
            section={section}
            isAdmin={isAdmin}
            canEdit={canEdit}
            canAssignLeads={canAssignLeads}
            canDeleteClient={permissions.includes("clients.delete")}
            allUsers={allUsers}
          />
        )}
      </div>
    </div>
  );
}
