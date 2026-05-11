import { getProjectById } from "@/lib/data";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default async function ProjectBudgetPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const mode = project.pricingMode ?? "manual";
  const allocation = project.roleAllocation ?? [];
  const subtotal = allocation.reduce(
    (s, l) => s + (l.days || 0) * (l.dayRate || 0) * (l.marginMultiplier || 1),
    0,
  );
  const payout = allocation.reduce(
    (s, l) => s + (l.isExternal && l.externalCostRate != null ? (l.days || 0) * l.externalCostRate : 0),
    0,
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          Pricing
        </h2>
        <span
          className="typo-tag inline-flex items-center px-2 py-0.5 rounded-badge"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
        >
          {mode === "rolebased" ? "Role-based" : "Fixed"}
        </span>
      </div>

      {mode === "rolebased" ? (
        allocation.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No role lines defined for this project.
          </p>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div
                className="grid items-center px-3 py-2 typo-section-header"
                style={{
                  gridTemplateColumns: "1fr 90px 130px",
                  gap: 8,
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                }}
              >
                <span>Role</span>
                <span>Days</span>
                <span className="text-right">Total</span>
              </div>
              {allocation.map((l, i) => (
                <div
                  key={i}
                  className="grid items-center px-3 py-2 text-sm"
                  style={{
                    gridTemplateColumns: "1fr 90px 130px",
                    gap: 8,
                    borderBottom: i < allocation.length - 1 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <span style={{ color: "var(--text-primary)" }}>
                    {l.roleName}
                    {l.isExternal && (
                      <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>(ext)</span>
                    )}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{l.days}</span>
                  <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatEuro((l.days || 0) * (l.dayRate || 0) * (l.marginMultiplier || 1))}
                  </span>
                </div>
              ))}
              <div
                className="grid items-center px-3 py-2 text-sm font-medium"
                style={{
                  gridTemplateColumns: "1fr 90px 130px",
                  gap: 8,
                  borderTop: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                }}
              >
                <span style={{ color: "var(--text-primary)" }}>Subtotal</span>
                <span />
                <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatEuro(subtotal)}
                </span>
              </div>
            </div>

            {payout > 0 && (
              <div
                className="rounded-lg px-4 py-3 space-y-2 text-sm"
                style={{ background: "var(--bg-app)", border: "1px dashed var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                    External pay-out
                  </p>
                  <span
                    className="typo-tag inline-flex items-center px-1.5 py-0.5 rounded-badge"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                  >
                    Internal only
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>Pay-out to externals</span>
                  <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                    − {formatEuro(payout)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Net for SUMM</span>
                  <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                    {formatEuro(subtotal - payout)}
                  </span>
                </div>
              </div>
            )}

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Role rates were snapshotted at the moment the project was created from its plan or template.
              Later edits to a role in admin do not change this project.
            </p>
          </>
        )
      ) : (
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--text-muted)" }}>Sold price</span>
            <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
              {project.soldPrice != null ? formatEuro(project.soldPrice) : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
