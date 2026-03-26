import { getDashboardStats, getClients } from "@/lib/data";

export const dynamic = "force-dynamic";
import Link from "next/link";

export default async function DashboardPage() {
  const [stats, clients] = await Promise.all([getDashboardStats(), getClients()]);

  const statCards = [
    { label: "Total Clients", value: stats.totalClients },
    { label: "Active Clients", value: stats.activeClients },
    { label: "Total Projects", value: stats.totalProjects },
    { label: "Active Projects", value: stats.activeProjects },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border p-5"
            style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Clients
          </h2>
          <Link href="/clients" className="text-xs font-medium" style={{ color: "var(--primary)" }}>
            View all →
          </Link>
        </div>
        {clients.length === 0 ? (
          <p className="px-5 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
            No clients yet.
          </p>
        ) : (
          <ul>
            {clients.slice(0, 5).map((client) => (
              <li
                key={client.id}
                className="border-b last:border-0"
                style={{ borderColor: "var(--border)" }}
              >
                <Link
                  href={`/clients/${client.id}`}
                  className="hover-row flex items-center justify-between px-5 py-3.5 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {client.company}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
