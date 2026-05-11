"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDate } from "@/lib/utils";

interface PlanListItem {
  id: string;
  clientId: string;
  title: string;
  status: "draft" | "ready" | "accepted" | "archived";
  draftCount: number;
  subtotal: number;
  presentedAt?: string | null;
  acceptedAt?: string | null;
  createdAt?: string | null;
}

const STATUS_BADGE: Record<PlanListItem["status"], { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "var(--bg-hover)", color: "var(--text-muted)" },
  ready: { label: "Ready", bg: "var(--info-light)", color: "var(--info)" },
  accepted: { label: "Accepted", bg: "var(--success-light)", color: "var(--success)" },
  archived: { label: "Archived", bg: "var(--bg-hover)", color: "var(--text-muted)" },
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function PlansListSection({ clientId }: { clientId: string }) {
  const [plans, setPlans] = useState<PlanListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch(`/api/clients/${clientId}/plans`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => { if (!cancelled) setPlans(d); })
        .catch(() => { if (!cancelled) setPlans([]); });
    }
    load();
    window.addEventListener("plan-created", load);
    return () => {
      cancelled = true;
      window.removeEventListener("plan-created", load);
    };
  }, [clientId]);

  if (plans === null) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading plans…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Project plans bundle multiple draft projects for internal review and (later) client approval.
      </p>

      {plans.length === 0 ? (
        <div className="flex items-center justify-center h-40 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No plans yet. Click &ldquo;Add Plan&rdquo; to start a proposal.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="grid px-4 py-2.5 typo-section-header"
            style={{
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
            }}
          >
            <span>Plan</span>
            <span className="text-right">Projects</span>
            <span className="text-right">Subtotal</span>
            <span className="text-right">Date</span>
            <span className="text-right">Accepted</span>
            <span className="text-right">Status</span>
          </div>
          {plans.map((p, idx) => {
            const badge = STATUS_BADGE[p.status];
            const dateLabel = p.presentedAt ?? p.createdAt ?? "";
            return (
              <Link
                key={p.id}
                href={`/clients/${clientId}/projects/plans/${p.id}`}
                className="grid items-center px-4 py-3 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                style={{
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                  borderBottom: idx < plans.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.title}</span>
                <span className="text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {p.draftCount}
                </span>
                <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatEuro(p.subtotal)}
                </span>
                <span className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
                  {fmtDate(dateLabel)}
                </span>
                <span className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
                  {p.acceptedAt ? fmtDate(p.acceptedAt) : "—"}
                </span>
                <span className="flex justify-end">
                  <span
                    className="typo-tag inline-flex items-center px-2 py-0.5 rounded-badge"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
