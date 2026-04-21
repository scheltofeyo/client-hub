"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarDays, ListOrdered, Dices, Mail } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

const categories = [
  {
    label: "Team",
    tools: [
      {
        href: "/tools/team",
        label: "Holiday Planner",
        description: "View the team calendar, manage time off, and track leave balances.",
        icon: CalendarDays,
        requires: "team.viewCalendar",
      },
      {
        href: "/tools/email-signature",
        label: "Email Signature",
        description: "Generate your SUMM email signature from your profile in seconds.",
        icon: Mail,
        requires: "tools.emailSignature.access",
      },
    ],
  },
  {
    label: "Workshops",
    tools: [
      {
        href: "/tools/ranking",
        label: "Ranking the Values",
        description: "Create and facilitate value-ranking sessions with live matching.",
        icon: ListOrdered,
        requires: "tools.ranking.access",
      },
      {
        href: "/tools/spin-the-wheel",
        label: "Spin the Wheel",
        description: "Randomly select participants using a spinning wheel or slot machine.",
        icon: Dices,
        requires: "tools.spinTheWheel.access",
      },
    ],
  },
];

export default function ToolsPage() {
  const { data: session } = useSession();
  const perms = session?.user?.permissions ?? [];

  const visibleCategories = categories
    .map((cat) => ({
      ...cat,
      tools: cat.tools.filter((t) => perms.includes(t.requires)),
    }))
    .filter((cat) => cat.tools.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader breadcrumbs={[{ label: "Tools" }]} title="Tools" />
      <div className="flex-1 overflow-y-auto px-7 pb-7 pt-6">
        {visibleCategories.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No tools available. Contact an admin to get access.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCategories.map((cat) => (
              <div key={cat.label}>
                <h2
                  className="typo-section-header mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  {cat.label}
                </h2>
                <div className="space-y-3">
                  {cat.tools.map(({ href, label, description, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block rounded-card border p-4 transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--bg-surface)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--primary)";
                        e.currentTarget.style.background = "var(--bg-elevated)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.background = "var(--bg-surface)";
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                        >
                          <Icon size={18} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
                            {label}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
