"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import ServicePills from "@/components/ui/ServicePills";
import RichTextEditor from "@/components/ui/RichTextEditor";
import UserAvatar from "@/components/ui/UserAvatar";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type {
  DiscountType,
  PricingMode,
  Project,
  ProjectLabel,
  ProjectRole,
  ProjectStatus,
  RoleAllocationLine,
  Service,
  TaskAssignee,
} from "@/types";
import EditorPanel, { type EditorTab } from "./EditorPanel";
import PanelSection from "./PanelSection";
import BudgetEditor from "./BudgetEditor";
import RichSectionGroup, { type RichSection } from "./RichSectionGroup";
import { useEditorDraft } from "./useEditorDraft";
import { formatEuro } from "./money";
import {
  SECTION_KEYS,
  calculateProjectSubtotal,
  calculateProjectDiscount,
  calculateProjectNet,
  calculateProjectPayout,
  type SectionKey,
} from "./draft-types";

type Tab = "about" | "budget";

/** The editable shape of a live project, normalised to nulls (not undefined). */
interface ProjectEditorSource {
  id: string;
  title: string;
  description: string | null;
  why: string | null;
  how: string | null;
  what: string | null;
  activities: string | null;
  deliverables: string | null;
  hiddenSections: string[];
  status: ProjectStatus;
  completedDate: string | null;
  deliveryDate: string | null;
  kickedOffAt: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  soldPrice: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  pricingMode: PricingMode;
  roleAllocation: RoleAllocationLine[];
  serviceId: string | null;
  labelId: string | null;
  members: TaskAssignee[];
}

/** Accepts both the `Project` prop (undefined-y) and the PATCH response (null-y). */
type RawProject = Partial<Omit<Project, "status" | "pricingMode">> & {
  id: string;
  title: string;
  status: ProjectStatus;
  hiddenSections?: string[] | null;
  completedDate?: string | null;
  deliveryDate?: string | null;
  kickedOffAt?: string | null;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  soldPrice?: number | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  pricingMode?: PricingMode | null;
  roleAllocation?: RoleAllocationLine[] | null;
  serviceId?: string | null;
  labelId?: string | null;
  members?: TaskAssignee[] | null;
};

function normalize(p: RawProject): ProjectEditorSource {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    why: p.why ?? null,
    how: p.how ?? null,
    what: p.what ?? null,
    activities: p.activities ?? null,
    deliverables: p.deliverables ?? null,
    hiddenSections: p.hiddenSections ?? [],
    status: p.status,
    completedDate: p.completedDate ?? null,
    deliveryDate: p.deliveryDate ?? null,
    kickedOffAt: p.kickedOffAt ?? null,
    scheduledStartDate: p.scheduledStartDate ?? null,
    scheduledEndDate: p.scheduledEndDate ?? null,
    soldPrice: p.soldPrice ?? null,
    discountType: p.discountType ?? null,
    discountValue: p.discountValue ?? null,
    pricingMode: p.pricingMode ?? "manual",
    roleAllocation: p.roleAllocation ?? [],
    serviceId: p.serviceId ?? null,
    labelId: p.labelId ?? null,
    members: p.members ?? [],
  };
}

/**
 * Full editor for one live project, mounted as the unpadded content of the
 * RightPanel. Mirrors the plan DraftProjectEditor (shared EditorPanel shell +
 * useEditorDraft explicit-save model), but covers a live project's fields:
 * details, proposal content, budget, and the reset/delete danger zone.
 */
export default function ProjectEditor({
  project,
  clientId,
  services,
  labels,
  projectRoles,
  assignableUsers,
  canDelete,
  canReset,
  onClose,
}: {
  project: Project;
  clientId: string;
  services: Service[];
  labels: ProjectLabel[];
  projectRoles: ProjectRole[];
  assignableUsers: { id: string; name: string; image: string | null }[];
  canDelete: boolean;
  canReset: boolean;
  onClose: () => void;
}) {
  const { registerCloseGuard } = useRightPanel();
  const [source, setSource] = useState<ProjectEditorSource>(() => normalize(project));
  const draft = useEditorDraft<ProjectEditorSource>(source);
  const [tab, setTab] = useState<Tab>("about");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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
      const body: Record<string, unknown> = { ...pending };
      if (pending.members !== undefined) {
        body.members = pending.members.map((m) => ({ userId: m.userId }));
      }
      const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Could not save changes. Please try again.");
        return null;
      }
      const updated = (await res.json()) as RawProject;
      setSource(normalize(updated));
      router.refresh();
      return pending;
    });
  }

  function toggleMember(u: { id: string; name: string; image: string | null }) {
    const cur = display.members;
    const next = cur.some((m) => m.userId === u.id)
      ? cur.filter((m) => m.userId !== u.id)
      : [...cur, { userId: u.id, name: u.name, image: u.image ?? undefined }];
    draft.setField("members", next);
  }

  function toggleSection(key: string) {
    const current = display.hiddenSections ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    draft.setField("hiddenSections", next);
  }

  async function handleReset() {
    if (
      !confirm(
        `Reset "${display.title}" to upcoming? This will clear the delivery date, financials, and project status.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kickedOffAt: null }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Failed to reset project.");
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete project "${display.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      setError("Failed to delete project.");
      return;
    }
    onClose();
    router.push(`/clients/${clientId}?tab=projects`);
    router.refresh();
  }

  const subtotal = calculateProjectSubtotal(display);
  const discount = calculateProjectDiscount(display);
  const net = calculateProjectNet(display);
  const payout = calculateProjectPayout(display);

  const serviceName = services.find((s) => s.id === display.serviceId)?.name ?? "No service";
  const notKickedOff = !display.kickedOffAt;
  const showDanger = (canReset && !!display.kickedOffAt) || canDelete;

  const tabs: EditorTab<Tab>[] = [
    { key: "about", label: "About" },
    { key: "budget", label: "Budget" },
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
        {serviceName}
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
      readOnly={false}
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
                onChange={(e) => draft.setField("title", e.target.value)}
                placeholder="Project name"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <ServicePills
              services={services}
              selectedId={display.serviceId ?? ""}
              onChange={(id) => draft.setField("serviceId", id || null)}
              label="Connect to a service"
              required
            />

            <div>
              <label className="typo-label">Description</label>
              <RichTextEditor
                key={`description-${draft.editorKey}`}
                content={display.description ?? ""}
                onChange={(html) => draft.setField("description", html)}
                placeholder="Describe the project scope…"
              />
            </div>

            <div>
              <label className="typo-label">Project members</label>
              <div className="flex flex-wrap gap-1.5">
                {assignableUsers.map((u) => {
                  const isActive = display.members.some((m) => m.userId === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u)}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        borderColor: isActive ? "var(--primary)" : "var(--border)",
                        color: isActive ? "var(--primary)" : "var(--text-muted)",
                        background: isActive ? "var(--primary-light)" : "transparent",
                      }}
                    >
                      <UserAvatar name={u.name} image={u.image} size={18} />
                      {u.name.split(" ")[0]}
                      {isActive && <span style={{ color: "var(--primary)" }}>×</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                Editing members updates the project only. Existing task assignees are not changed.
              </p>
            </div>

            {notKickedOff ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="typo-label">Scheduled start</label>
                  <input
                    type="date"
                    value={display.scheduledStartDate ?? ""}
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
                    onChange={(e) => draft.setField("scheduledEndDate", e.target.value || null)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="typo-label">Kick-off date</label>
                  <input
                    type="date"
                    value={display.kickedOffAt ?? ""}
                    onChange={(e) => draft.setField("kickedOffAt", e.target.value || null)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="typo-label">Expected delivery</label>
                  <input
                    type="date"
                    value={display.deliveryDate ?? ""}
                    onChange={(e) => draft.setField("deliveryDate", e.target.value || null)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {display.status === "completed" && (
              <div>
                <label className="typo-label">Completed date</label>
                <input
                  type="date"
                  value={display.completedDate ?? ""}
                  onChange={(e) => draft.setField("completedDate", e.target.value || null)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label className="typo-label">Label</label>
              <select
                value={display.labelId ?? ""}
                onChange={(e) => draft.setField("labelId", e.target.value || null)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— No label —</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </PanelSection>

          <PanelSection
            title="Proposal content"
            description="These sections appear on the client's proposal overview. Hide any you don't need."
          >
            <RichSectionGroup
              sections={richSections}
              editorKey={draft.editorKey}
              readonly={false}
              onChange={(key, html) => draft.setField(key as SectionKey, html)}
              onToggleHidden={toggleSection}
            />
          </PanelSection>

          {showDanger && (
            <PanelSection title="Danger zone">
              <div className="flex flex-wrap gap-2">
                {canReset && display.kickedOffAt && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-border border"
                  >
                    <RotateCcw size={13} />
                    Reset to upcoming
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-danger"
                  >
                    <Trash2 size={13} />
                    Delete project
                  </button>
                )}
              </div>
            </PanelSection>
          )}
        </div>
      )}

      {tab === "budget" && (
        <PanelSection title="Pricing" description="Role-based budget or a fixed price.">
          <BudgetEditor
            pricingMode={display.pricingMode}
            allocation={display.roleAllocation}
            projectRoles={projectRoles}
            readonly={false}
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
                onChange={(e) =>
                  draft.setFields({
                    discountType: (e.target.value || null) as DiscountType | null,
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
                disabled={!display.discountType}
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
    </EditorPanel>
  );
}
