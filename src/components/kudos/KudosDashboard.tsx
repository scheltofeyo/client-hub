"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import type { KudosStats, KudosLeaderItem } from "@/types";

export default function KudosDashboard() {
  const [stats, setStats] = useState<KudosStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/kudos/stats");
      if (cancelled) return;
      if (res.ok) setStats(await res.json());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Statistieken laden…
      </p>
    );
  }

  if (!stats) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Geen statistieken beschikbaar.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
      <StatCard label="Schouderklopjes deze week" value={stats.weekTotal} />
      <StatCard label="Schouderklopjes deze maand" value={stats.monthTotal} />

      <LeaderCard title="Meest geliefd deze week" subtitle="Ontvangers" items={stats.topReceiversWeek} />
      <LeaderCard title="Royaalste collega's deze week" subtitle="Gevers" items={stats.topGiversWeek} />

      <LeaderCard title="Meest geliefd deze maand" subtitle="Ontvangers" items={stats.topReceiversMonth} />
      <LeaderCard title="Royaalste collega's deze maand" subtitle="Gevers" items={stats.topGiversMonth} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-card border p-5"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="typo-metric mt-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function LeaderCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: KudosLeaderItem[];
}) {
  return (
    <div
      className="rounded-card border p-5"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <p className="typo-section-header mb-3" style={{ color: "var(--text-muted)" }}>
        {subtitle} — {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nog niemand in beeld.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.userId} className="flex items-center gap-3">
              <UserAvatar name={item.name} image={item.image} size={28} />
              <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
                {item.name}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full tabular-nums"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
