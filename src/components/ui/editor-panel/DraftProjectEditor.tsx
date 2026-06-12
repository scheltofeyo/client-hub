"use client";

import { useCallback, useEffect, useState } from "react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { usePermission } from "@/hooks/usePermission";
import { SessionForm } from "@/components/ui/SessionsTab";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { ProjectRole, Session } from "@/types";
import EditorPanel, { type EditorTab } from "./EditorPanel";
import PanelSection from "./PanelSection";
import BudgetEditor from "./BudgetEditor";
import RichSectionGroup, { type RichSection } from "./RichSectionGroup";
import SessionsListEditor, { type SessionListItem } from "./SessionsListEditor";
import DraftTasksList from "./DraftTasksList";
import { useEditorDraft } from "./useEditorDraft";
import { formatEuro } from "./money";
import {
  SECTION_KEYS,
  calculateProjectSubtotal,
  calculateProjectDiscount,
  calculateProjectPayout,
  type DraftProject,
  type DraftTask,
  type SectionKey,
} from "./draft-types";

type Tab = "about" | "budget" | "sessions" | "tasks";

/**
 * Full editor for one draft project, mounted as the unpadded content of the
 * RightPanel. Reuses the shared EditorPanel shell + useEditorDraft explicit-save
 * model. Sessions/tasks forms open in stacked panels on top of this one.
 */
export default function DraftProjectEditor({
  project,
  clientId,
  planAccepted,
  canEdit,
  projectRoles,
  assignableUsers,
  tasks: initialTasks,
  sessions: initialSessions,
  onUpdate,
  onSessionsChanged,
  onTasksChanged,
}: {
  project: DraftProject;
  clientId: string;
  planAccepted: boolean;
  canEdit: boolean;
  projectRoles: ProjectRole[];
  assignableUsers: { id: string; name: string; image: string | null }[];
  tasks: DraftTask[];
  sessions: Session[];
  onUpdate: (patch: Partial<DraftProject>) => void;
  onSessionsChanged: () => void | Promise<void>;
  onTasksChanged: () => void | Promise<void>;
}) {
  const { openSecondaryPanel, closeSecondaryPanel, registerCloseGuard } = useRightPanel();
  const draft = useEditorDraft<DraftProject>(project);
  const [tab, setTab] = useState<Tab>("about");
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [taskCount, setTaskCount] = useState(initialTasks.filter((t) => !t.parentTaskId).length);

  const readonly = planAccepted || !canEdit;

  const canCreateSession = usePermission("sessions.create");
  const canEditSession = usePermission("sessions.edit");
  const canDeleteSession = usePermission("sessions.delete");
  const canCreateTask = usePermission("tasks.create");
  const canEditAnyTask = usePermission("tasks.editAny");
  const canDeleteAnyTask = usePermission("tasks.deleteAny");

  const display = draft.display;
  const hiddenSet = new Set(display.hiddenSections ?? []);

  // Guard against closing the panel with unsaved field edits.
  useEffect(() => {
    registerCloseGuard(() => {
      if (!draft.dirty) return true;
      return confirm("You have unsaved changes in this project. Discard them and close?");
    });
    return () => registerCloseGuard(null);
  }, [registerCloseGuard, draft.dirty]);

  async function save() {
    setError(null);
    await draft.save(async (pending) => {
      const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      if (!res.ok) {
        setError("Could not save changes. Please try again.");
        return null;
      }
      const updated = await res.json();
      const patch: Partial<DraftProject> = {
        title: updated.title,
        description: updated.description ?? null,
        why: updated.why ?? null,
        how: updated.how ?? null,
        what: updated.what ?? null,
        activities: updated.activities ?? null,
        deliverables: updated.deliverables ?? null,
        hiddenSections: updated.hiddenSections ?? [],
        soldPrice: updated.soldPrice ?? null,
        discountType: updated.discountType ?? null,
        discountValue: updated.discountValue ?? null,
        pricingMode: updated.pricingMode ?? "manual",
        roleAllocation: updated.roleAllocation ?? [],
        scheduledStartDate: updated.scheduledStartDate ?? null,
        scheduledEndDate: updated.scheduledEndDate ?? null,
        serviceId: updated.serviceId ?? null,
        serviceName: updated.serviceName ?? null,
      };
      onUpdate(patch);
      return patch;
    });
  }

  function toggleSection(key: string) {
    const current = display.hiddenSections ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    draft.setField("hiddenSections", next);
  }

  const reloadSessions = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}/sessions`);
    if (res.ok) setSessions(await res.json());
    await onSessionsChanged();
  }, [clientId, project.id, onSessionsChanged]);

  async function reorderSessions(ids: string[]) {
    setSessions((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return ids.map((id) => byId.get(id)).filter((s): s is Session => !!s);
    });
    await fetch(`/api/clients/${clientId}/projects/${project.id}/sessions/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  }

  function openSessionForm(session?: SessionListItem) {
    const full = session ? sessions.find((s) => s.id === session.id) : undefined;
    openSecondaryPanel(
      session ? "Edit session" : "New session",
      <SessionForm
        clientId={clientId}
        projectId={project.id}
        session={full}
        onSaved={reloadSessions}
        onClose={closeSecondaryPanel}
      />
    );
  }

  async function deleteSession(session: SessionListItem) {
    if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}/sessions/${session.id}`, {
      method: "DELETE",
    });
    if (res.ok) await reloadSessions();
  }

  const subtotal = calculateProjectSubtotal(display);
  const discount = calculateProjectDiscount(display);
  const net = subtotal - discount;
  const payout = calculateProjectPayout(display);

  const tabs: EditorTab<Tab>[] = [
    { key: "about", label: "About" },
    { key: "budget", label: "Budget" },
    { key: "sessions", label: "Sessions", count: sessions.length },
    { key: "tasks", label: "Tasks", count: taskCount },
  ];

  const richSections: RichSection[] = SECTION_KEYS.map((key) => ({
    key,
    label: key,
    value: display[key],
    hidden: hiddenSet.has(key),
  }));

  const headerMeta = (
    <div className="flex items-center justify-between gap-3">
      <span className="typo-section-header truncate" style={{ color: "var(--text-muted)" }}>
        {display.serviceName ?? "Draft project"}
      </span>
      <span className="text-right shrink-0">
        {discount > 0 && (
          <span className="mr-2 text-sm tabular-nums line-through" style={{ color: "var(--text-muted)" }}>
            {formatEuro(subtotal)}
          </span>
        )}
        <span className="text-base tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
          {formatEuro(net)}
        </span>
        {discount > 0 && (
          <span className="block typo-caption tabular-nums">
            − {formatEuro(discount)} discount
          </span>
        )}
        {payout > 0 && (
          <span className="block typo-caption tabular-nums">
            − {formatEuro(payout)} ext · {formatEuro(net - payout)} net
          </span>
        )}
      </span>
    </div>
  );

  return (
    <EditorPanel<Tab>
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      dirty={draft.dirty}
      saving={draft.saving}
      readOnly={readonly}
      onSave={save}
      onDiscard={draft.discard}
      error={error}
      headerMeta={headerMeta}
    >
      {tab === "about" && (
        <div className="space-y-8">
          <PanelSection title="Details">
            <div>
              <label className="typo-label">Project name</label>
              <input
                type="text"
                value={display.title}
                disabled={readonly}
                onChange={(e) => draft.setField("title", e.target.value)}
                placeholder="Project name"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="typo-label">Scheduled start</label>
                <input
                  type="date"
                  value={display.scheduledStartDate ?? ""}
                  disabled={readonly}
                  onChange={(e) => draft.setField("scheduledStartDate", e.target.value || null)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="typo-label">Scheduled end</label>
                <input
                  type="date"
                  value={display.scheduledEndDate ?? ""}
                  disabled={readonly}
                  onChange={(e) => draft.setField("scheduledEndDate", e.target.value || null)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>
          </PanelSection>

          <PanelSection
            title="Proposal content"
            description="These sections appear on the client's proposal. Hide any you don't need."
          >
            <RichSectionGroup
              sections={richSections}
              editorKey={draft.editorKey}
              readonly={readonly}
              onChange={(key, html) => draft.setField(key as SectionKey, html)}
              onToggleHidden={readonly ? undefined : toggleSection}
            />
          </PanelSection>
        </div>
      )}

      {tab === "budget" && (
        <PanelSection title="Pricing" description="Role-based budget or a fixed price. Totals roll up to the plan.">
          <BudgetEditor
            pricingMode={display.pricingMode}
            allocation={display.roleAllocation}
            projectRoles={projectRoles}
            readonly={readonly}
            showAssignedColumn
            assignableUsers={assignableUsers}
            onChange={(allocation, pricingMode) => draft.setFields({ roleAllocation: allocation, pricingMode })}
          />
          {display.pricingMode === "manual" && (
            <div>
              <label className="typo-label">Sold price (EUR)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={display.soldPrice ?? ""}
                disabled={readonly}
                onChange={(e) => draft.setField("soldPrice", e.target.value === "" ? null : Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="typo-label">Discount type</label>
              <select
                value={display.discountType ?? ""}
                disabled={readonly}
                onChange={(e) =>
                  draft.setFields({
                    discountType: (e.target.value || null) as DraftProject["discountType"],
                    ...(e.target.value === "" ? { discountValue: null } : {}),
                  })
                }
                className={inputClass}
                style={inputStyle}
              >
                <option value="">No discount</option>
                <option value="percentage">Percentage</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <label className="typo-label">
                Discount value{display.discountType === "percentage" ? " (%)" : display.discountType === "amount" ? " (EUR)" : ""}
              </label>
              <input
                type="number"
                min={0}
                step={display.discountType === "percentage" ? 1 : 100}
                value={display.discountValue ?? ""}
                disabled={readonly || !display.discountType}
                onChange={(e) => draft.setField("discountValue", e.target.value === "" ? null : Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
          {discount > 0 && (
            <p className="typo-caption tabular-nums">
              {formatEuro(subtotal)} − {formatEuro(discount)} discount = <strong>{formatEuro(net)}</strong> for the client
            </p>
          )}
        </PanelSection>
      )}

      {tab === "sessions" && (
        <PanelSection title="Sessions" description="Workshops or meetings planned with the client for this project.">
          <SessionsListEditor
            sessions={[...sessions]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((s) => ({ id: s.id, title: s.title, date: s.date }))}
            readonly={readonly}
            canCreate={canCreateSession}
            canEdit={canEditSession}
            canDelete={canDeleteSession}
            onOpenForm={openSessionForm}
            onDelete={deleteSession}
            onReorder={reorderSessions}
          />
        </PanelSection>
      )}

      {tab === "tasks" && (
        <PanelSection title="Internal tasks" description="Never shared with the client — for your team only.">
          <DraftTasksList
            clientId={clientId}
            projectId={project.id}
            tasks={initialTasks}
            users={assignableUsers}
            readonly={readonly}
            canCreateTask={canCreateTask}
            canEditAnyTask={canEditAnyTask}
            canDeleteAnyTask={canDeleteAnyTask}
            onTasksChanged={onTasksChanged}
            onCountChange={setTaskCount}
          />
        </PanelSection>
      )}
    </EditorPanel>
  );
}
