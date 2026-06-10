import type { DiscountType, RoleAllocationLine, Task, TaskAssignee } from "@/types";
import { discountAmountFor } from "@/lib/pricing";
import { sumTotals, sumPayouts } from "./money";

/** A draft project inside a plan (the proposal building block). */
export interface DraftProject {
  id: string;
  clientId: string;
  planId: string;
  title: string;
  description: string | null;
  why: string | null;
  how: string | null;
  what: string | null;
  activities: string | null;
  deliverables: string | null;
  hiddenSections: string[];
  status: "draft" | "not_started" | "in_progress" | "completed";
  soldPrice: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  pricingMode: "manual" | "rolebased";
  roleAllocation: RoleAllocationLine[];
  serviceId: string | null;
  serviceName: string | null;
  templateId: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  members: TaskAssignee[];
  createdAt?: string | null;
}

export interface DraftTask {
  id: string;
  clientId: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  sessionId: string | null;
  title: string;
  description: string | null;
  assignees: TaskAssignee[];
  completionDate: string | null;
  completedAt: string | null;
  order: number;
  createdById: string;
  createdByName: string;
}

export const SECTION_KEYS = ["why", "what", "how", "activities", "deliverables"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export function draftTaskToTask(t: DraftTask): Task {
  return {
    id: t.id,
    clientId: t.clientId ?? undefined,
    projectId: t.projectId ?? undefined,
    parentTaskId: t.parentTaskId ?? undefined,
    sessionId: t.sessionId ?? undefined,
    title: t.title,
    description: t.description ?? undefined,
    assignees: t.assignees,
    completionDate: t.completionDate ?? undefined,
    completedAt: t.completedAt ?? undefined,
    order: t.order,
    createdById: t.createdById,
    createdByName: t.createdByName,
  };
}

/** Gross sell value of a project (role-based sum or the manual sold price). */
export function calculateProjectSubtotal(p: Pick<DraftProject, "pricingMode" | "roleAllocation" | "soldPrice">): number {
  if (p.pricingMode === "rolebased" && p.roleAllocation) {
    return sumTotals(p.roleAllocation);
  }
  return p.soldPrice ?? 0;
}

/** Euro discount for a project, derived from its gross subtotal. */
export function calculateProjectDiscount(
  p: Pick<DraftProject, "pricingMode" | "roleAllocation" | "soldPrice" | "discountType" | "discountValue">
): number {
  return discountAmountFor(calculateProjectSubtotal(p), p.discountType, p.discountValue);
}

/** Net sell value of a project (gross subtotal minus discount). */
export function calculateProjectNet(
  p: Pick<DraftProject, "pricingMode" | "roleAllocation" | "soldPrice" | "discountType" | "discountValue">
): number {
  return calculateProjectSubtotal(p) - calculateProjectDiscount(p);
}

/** External pay-out for a project (internal-only metric). */
export function calculateProjectPayout(p: Pick<DraftProject, "pricingMode" | "roleAllocation">): number {
  if (p.pricingMode !== "rolebased" || !p.roleAllocation) return 0;
  return sumPayouts(p.roleAllocation);
}
