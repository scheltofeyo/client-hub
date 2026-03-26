import { getClients } from "@/lib/data";
import Link from "next/link";
import Image from "next/image";
import AddClientButton from "@/components/ui/AddClientButton";
import type { Client } from "@/types";

export const dynamic = "force-dynamic";

const ACCENT_COLORS = [
  "#7C3AED", // purple
  "#2563EB", // blue
  "#059669", // green
  "#D97706", // amber
  "#DC2626", // red
  "#7C3AED", // violet
  "#DB2777", // pink
  "#0891B2", // cyan
];

function accentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function initials(company: string): string {
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function leadInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function ClientCard({ client }: { client: Client }) {
  const color = accentColor(client.company);
  const abbr = initials(client.company);

  return (
    <Link
      href={`/clients/${client.id}`}
      className="group flex flex-col rounded-2xl border overflow-hidden hover:shadow-md transition-shadow"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: color }} />

      <div className="flex items-center justify-between p-5 gap-3">
        {/* Monogram + company name */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold"
            style={{ background: color }}
          >
            {abbr}
          </div>
          <p
            className="font-semibold text-sm leading-snug truncate group-hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-primary)" }}
          >
            {client.company}
          </p>
        </div>

        {/* Lead avatars */}
        {client.leads && client.leads.length > 0 && (
          <div className="flex items-center shrink-0">
            {client.leads.map((lead, i) => (
              <div
                key={lead.userId}
                title={lead.name}
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{
                  background: accentColor(lead.name),
                  marginLeft: i === 0 ? 0 : "-6px",
                  outline: "2px solid var(--bg-surface)",
                  zIndex: i,
                }}
              >
                {lead.image ? (
                  <Image src={lead.image} alt={lead.name} width={28} height={28} className="object-cover w-full h-full" />
                ) : (
                  leadInitials(lead.name)
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Clients
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {clients.length} {clients.length === 1 ? "client" : "clients"}
          </p>
        </div>
        <AddClientButton />
      </div>

      {clients.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            No clients yet
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Add your first client to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
