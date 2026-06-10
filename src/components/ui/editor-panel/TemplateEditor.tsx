"use client";

import { useEffect, useMemo, useState } from "react";
import { useRightPanel } from "@/components/layout/RightPanel";
import RichTextEditor from "@/components/ui/RichTextEditor";
import ServicePills from "@/components/ui/ServicePills";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { DiscountType, ProjectRole, ProjectTemplate, RoleAllocationLine, Service, TemplateSession, TemplateTask } from "@/types";
import { discountAmountFor } from "@/lib/pricing";
import EditorPanel, { type EditorTab } from "./EditorPanel";
import PanelSection from "./PanelSection";
import BudgetEditor from "./BudgetEditor";
import RichSectionGroup, { type RichSection } from "./RichSectionGroup";
import TemplateTasksSection from "./TemplateTasksSection";
import TemplateSessionsSection from "./TemplateSessionsSection";
import { useEditorDraft } from "./useEditorDraft";
import { formatEuro, sumTotals } from "./money";

type Tab = "settings" | "budget" | "tasks" | "sessions";

interface TemplateDraft {
  name: string;
  summary: string;
  defaultDescription: string;
  defaultWhy: string;
  defaultHow: string;
  defaultWhat: string;
  defaultActivities: string;
  defaultDeliverables: string;
  defaultSoldPrice: string;
  defaultDiscountType: DiscountType | "";
  defaultDiscountValue: string;
  defaultServiceId: string;
  defaultDeliveryDays: string;
  pricingMode: "manual" | "rolebased";
  roleAllocation: RoleAllocationLine[];
}

const RICH_FIELDS: { key: keyof TemplateDraft; label: string }[] = [
  { key: "defaultWhy", label: "Why" },
  { key: "defaultWhat", label: "What" },
  { key: "defaultHow", label: "How" },
  { key: "defaultActivities", label: "Activities" },
  { key: "defaultDeliverables", label: "Deliverables" },
];

/**
 * Full editor for one project template, mounted as the unpadded content of the
 * RightPanel. Shares the EditorPanel shell + useEditorDraft explicit-save model
 * with the plan draft-project editor. Tasks/sessions are loaded lazily and save
 * immediately; Settings + Budget save together via the footer.
 */
export default function TemplateEditor({
  template,
  services,
  projectRoles,
  onUpdate,
}: {
  template: ProjectTemplate;
  services: Service[];
  projectRoles: ProjectRole[];
  onUpdate: (patch: Partial<ProjectTemplate>) => void;
}) {
  const { registerCloseGuard } = useRightPanel();

  const initial = useMemo<TemplateDraft>(
    () => ({
      name: template.name,
      summary: template.summary ?? "",
      defaultDescription: template.defaultDescription ?? "",
      defaultWhy: template.defaultWhy ?? "",
      defaultHow: template.defaultHow ?? "",
      defaultWhat: template.defaultWhat ?? "",
      defaultActivities: template.defaultActivities ?? "",
      defaultDeliverables: template.defaultDeliverables ?? "",
      defaultSoldPrice: template.defaultSoldPrice != null ? String(template.defaultSoldPrice) : "",
      defaultDiscountType: template.defaultDiscountType ?? "",
      defaultDiscountValue: template.defaultDiscountValue != null ? String(template.defaultDiscountValue) : "",
      defaultServiceId: template.defaultServiceId ?? "",
      defaultDeliveryDays: template.defaultDeliveryDays != null ? String(template.defaultDeliveryDays) : "",
      pricingMode: template.defaultPricingMode ?? "rolebased",
      roleAllocation: (template.defaultRoleAllocation ?? []).map((l) => ({ ...l })),
    }),
    [template]
  );

  const draft = useEditorDraft<TemplateDraft>(initial);
  const display = draft.display;
  const [tab, setTab] = useState<Tab>("settings");
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TemplateTask[] | null>(null);
  const [sessions, setSessions] = useState<TemplateSession[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/project-templates/${template.id}/tasks`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => alive && setTasks(d))
      .catch(() => alive && setTasks([]));
    fetch(`/api/project-templates/${template.id}/sessions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => alive && setSessions(d))
      .catch(() => alive && setSessions([]));
    return () => {
      alive = false;
    };
  }, [template.id]);

  useEffect(() => {
    registerCloseGuard(() => {
      if (!draft.dirty) return true;
      return confirm("You have unsaved changes in this template. Discard them and close?");
    });
    return () => registerCloseGuard(null);
  }, [registerCloseGuard, draft.dirty]);

  async function save() {
    setError(null);
    if (!display.name.trim()) {
      setError("Template name is required.");
      setTab("settings");
      return;
    }
    if (!display.defaultServiceId) {
      setError("Please select a service.");
      setTab("settings");
      return;
    }
    await draft.save(async () => {
      const res = await fetch(`/api/project-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: display.name.trim(),
          summary: display.summary || undefined,
          defaultDescription: display.defaultDescription || undefined,
          defaultWhy: display.defaultWhy || undefined,
          defaultHow: display.defaultHow || undefined,
          defaultWhat: display.defaultWhat || undefined,
          defaultActivities: display.defaultActivities || undefined,
          defaultDeliverables: display.defaultDeliverables || undefined,
          defaultSoldPrice: display.defaultSoldPrice ? Number(display.defaultSoldPrice) : undefined,
          defaultDiscountType: display.defaultDiscountType || null,
          defaultDiscountValue: display.defaultDiscountValue ? Number(display.defaultDiscountValue) : null,
          defaultServiceId: display.defaultServiceId || undefined,
          defaultDeliveryDays: display.defaultDeliveryDays ? Number(display.defaultDeliveryDays) : undefined,
          defaultPricingMode: display.pricingMode,
          defaultRoleAllocation: display.pricingMode === "rolebased" ? display.roleAllocation : [],
        }),
      });
      if (!res.ok) {
        setError("Could not save the template. Please try again.");
        return null;
      }
      const updated = await res.json();
      onUpdate({
        name: updated.name,
        summary: updated.summary ?? undefined,
        defaultDescription: updated.defaultDescription ?? undefined,
        defaultServiceId: updated.defaultServiceId ?? undefined,
        defaultSoldPrice: updated.defaultSoldPrice ?? undefined,
        defaultDiscountType: updated.defaultDiscountType ?? undefined,
        defaultDiscountValue: updated.defaultDiscountValue ?? undefined,
        defaultDeliveryDays: updated.defaultDeliveryDays ?? undefined,
        defaultPricingMode: updated.defaultPricingMode,
        defaultRoleAllocation: updated.defaultRoleAllocation,
      });
      return {};
    });
  }

  const richSections: RichSection[] = RICH_FIELDS.map(({ key, label }) => ({
    key,
    label,
    value: (display[key] as string) ?? "",
  }));

  const grossPrice =
    display.pricingMode === "rolebased" ? sumTotals(display.roleAllocation) : Number(display.defaultSoldPrice || 0);
  const discount = discountAmountFor(
    grossPrice,
    display.defaultDiscountType || null,
    display.defaultDiscountValue ? Number(display.defaultDiscountValue) : null
  );
  const price = grossPrice - discount;
  const serviceName = services.find((s) => s.id === display.defaultServiceId)?.name;

  const tabs: EditorTab<Tab>[] = [
    { key: "settings", label: "Settings" },
    { key: "budget", label: "Budget" },
    { key: "tasks", label: "Tasks", count: tasks ? tasks.filter((t) => !t.parentTaskId).length : undefined },
    { key: "sessions", label: "Sessions", count: sessions?.length },
  ];

  const headerMeta = (
    <div className="flex items-center justify-between gap-3 pb-3">
      <span className="typo-section-header truncate" style={{ color: "var(--text-muted)" }}>
        {serviceName ?? "Template"}
      </span>
      {price > 0 && (
        <span className="text-sm tabular-nums font-medium shrink-0" style={{ color: "var(--text-primary)" }}>
          {discount > 0 && (
            <span className="mr-1.5 line-through font-normal" style={{ color: "var(--text-muted)" }}>
              {formatEuro(grossPrice)}
            </span>
          )}
          {formatEuro(price)}
        </span>
      )}
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
      {tab === "settings" && (
        <div className="space-y-8">
          <PanelSection title="Details">
            <div>
              <label className="typo-label">
                Template name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={display.name}
                onChange={(e) => draft.setField("name", e.target.value)}
                placeholder="e.g. Website Project"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <ServicePills
              services={services}
              selectedId={display.defaultServiceId}
              onChange={(id) => draft.setField("defaultServiceId", id)}
              label="Service"
              required
            />

            <div>
              <label className="typo-label">Summary</label>
              <input
                type="text"
                value={display.summary}
                onChange={(e) => draft.setField("summary", e.target.value)}
                placeholder="Shown under the title when picking a template"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="typo-label">Delivery — days after creation</label>
              <input
                type="number"
                min={1}
                step={1}
                value={display.defaultDeliveryDays}
                onChange={(e) => draft.setField("defaultDeliveryDays", e.target.value)}
                placeholder="e.g. 30"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </PanelSection>

          <PanelSection
            title="Default proposal content"
            description="Pre-fills the matching fields on every project created from this template."
          >
            <div>
              <label className="typo-label">Default project description</label>
              <RichTextEditor
                key={`desc-${draft.editorKey}`}
                content={display.defaultDescription}
                onChange={(html) => draft.setField("defaultDescription", html)}
                placeholder="Pre-fills the project description field…"
              />
            </div>

            <RichSectionGroup
              sections={richSections}
              editorKey={draft.editorKey}
              readonly={false}
              onChange={(key, html) => draft.setField(key as keyof TemplateDraft, html)}
            />
          </PanelSection>
        </div>
      )}

      {tab === "budget" && (
        <PanelSection
          title="Pricing"
          description="Pricing model and snapshotted role lines copied onto each project created from this template."
        >
          <BudgetEditor
            pricingMode={display.pricingMode}
            allocation={display.roleAllocation}
            projectRoles={projectRoles}
            onChange={(allocation, pricingMode) => draft.setFields({ roleAllocation: allocation, pricingMode })}
          />
          {display.pricingMode === "manual" && (
            <div>
              <label className="typo-label">Default sold price (EUR)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={display.defaultSoldPrice}
                onChange={(e) => draft.setField("defaultSoldPrice", e.target.value)}
                placeholder="e.g. 5000"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="typo-label">Default discount type</label>
              <select
                value={display.defaultDiscountType}
                onChange={(e) =>
                  draft.setFields({
                    defaultDiscountType: e.target.value as TemplateDraft["defaultDiscountType"],
                    ...(e.target.value === "" ? { defaultDiscountValue: "" } : {}),
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
                Default discount value{display.defaultDiscountType === "percentage" ? " (%)" : display.defaultDiscountType === "amount" ? " (EUR)" : ""}
              </label>
              <input
                type="number"
                min={0}
                step={display.defaultDiscountType === "percentage" ? 1 : 100}
                value={display.defaultDiscountValue}
                disabled={!display.defaultDiscountType}
                onChange={(e) => draft.setField("defaultDiscountValue", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
        </PanelSection>
      )}

      {tab === "tasks" &&
        (tasks === null ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading tasks…
          </p>
        ) : (
          <PanelSection title="Internal tasks" description="Copied onto each project created from this template.">
            <TemplateTasksSection templateId={template.id} tasks={tasks} onTasksChange={setTasks} />
          </PanelSection>
        ))}

      {tab === "sessions" &&
        (sessions === null ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading sessions…
          </p>
        ) : (
          <PanelSection title="Sessions">
            <TemplateSessionsSection templateId={template.id} sessions={sessions} onSessionsChange={setSessions} />
          </PanelSection>
        ))}
    </EditorPanel>
  );
}
