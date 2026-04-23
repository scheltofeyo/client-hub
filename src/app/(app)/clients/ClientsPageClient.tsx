"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AddClientButton from "@/components/ui/AddClientButton";
import ClientsOverviewTable from "./ClientsOverviewTable";
import ClientsTimeline from "@/components/ui/ClientsTimeline";
import DataTable from "@/components/ui/DataTable";
import type { SortState, ColumnDef } from "@/components/ui/DataTable";
import type { Client, ClientStatusOption, ClientPlatformOption, Project } from "@/types";
import type { OverviewRow } from "./ClientsOverviewTable";

import { accentColor, clientColor } from "@/lib/styles";

// ── helpers ────────────────────────────────────────────────────────────────

function initials(company: string): string {
  return company.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function leadInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── card ──────────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: Client }) {
  const { bg, fg } = clientColor(client);
  const abbr = initials(client.company);

  return (
    <Link
      href={`/clients/${client.id}`}
      className="group flex flex-col rounded-2xl border overflow-hidden hover:shadow-lg transition-all duration-200"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div
        className="flex items-start px-4 pt-4 pb-0"
        style={{ background: `color-mix(in srgb, ${bg} 8%, transparent)`, height: "40px" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm mb-[-24px] z-10"
          style={{ background: bg, color: fg }}
        >
          {abbr}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-8 pb-4">
        <p
          className="font-semibold text-base leading-snug group-hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-primary)" }}
        >
          {client.company}
        </p>

        {(client.status || client.platformLabel) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {client.status && (
              <span
                className="text-xs px-2 py-0.5 rounded-full border font-medium capitalize"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-elevated)",
                }}
              >
                {client.status.replace(/_/g, " ")}
              </span>
            )}
            {client.platformLabel && (
              <span
                className="text-xs px-2 py-0.5 rounded-full border font-medium"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-elevated)",
                }}
              >
                {client.platformLabel}
              </span>
            )}
          </div>
        )}

        <div className="border-t" style={{ borderColor: "var(--border)" }} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {client.clientSince && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Since {new Date(client.clientSince).getFullYear()}
              </span>
            )}
          </div>

          {client.leads && client.leads.length > 0 && (
            <div className="flex items-center shrink-0">
              {client.leads.map((lead, i) => (
                <div
                  key={lead.userId}
                  title={lead.name}
                  className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                  style={{
                    background: accentColor(lead.name),
                    marginLeft: i === 0 ? 0 : "-5px",
                    outline: "2px solid var(--bg-surface)",
                    zIndex: i,
                  }}
                >
                  {lead.image ? (
                    <Image
                      src={lead.image}
                      alt={lead.name}
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    leadInitials(lead.name)
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── filter chips ──────────────────────────────────────────────────────────

function FilterChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { slug: string; label: string }[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {options.map((opt) => {
        const active = selected.has(opt.slug);
        return (
          <button
            key={opt.slug}
            type="button"
            onClick={() => onToggle(opt.slug)}
            className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors"
            style={
              active
                ? {
                    background: "var(--primary)",
                    borderColor: "var(--primary)",
                    color: "#fff",
                  }
                : {
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── section grid ──────────────────────────────────────────────────────────

function SectionGrid({ clients }: { clients: Client[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
}

// ── other-clients table ──────────────────────────────────────────────────

function OtherClientsTable({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ col: "company", dir: "asc" });

  function onSort(col: string) {
    setSort((prev) =>
      prev.col === col
        ? prev.dir === "asc"
          ? { col, dir: "desc" }
          : { col: null, dir: "asc" }
        : { col, dir: "asc" }
    );
  }

  const sorted = useMemo(() => {
    const list = [...clients];
    if (!sort.col) return list.sort((a, b) => a.company.localeCompare(b.company));
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      switch (sort.col) {
        case "company":
          return dir * a.company.localeCompare(b.company);
        case "status":
          return dir * (a.status ?? "").localeCompare(b.status ?? "");
        case "platform":
          return dir * (a.platformLabel ?? "").localeCompare(b.platformLabel ?? "");
        case "clientSince": {
          const ya = a.clientSince ? new Date(a.clientSince).getFullYear() : 0;
          const yb = b.clientSince ? new Date(b.clientSince).getFullYear() : 0;
          return dir * (ya - yb);
        }
        default:
          return 0;
      }
    });
  }, [clients, sort]);

  const columns: ColumnDef<Client>[] = useMemo(
    () => [
      {
        key: "company",
        label: "Client",
        minWidth: 200,
        sortable: true,
        sticky: true,
        render: (row) => {
          const { bg, fg } = clientColor(row);
          return (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: bg, color: fg }}
              >
                {initials(row.company)}
              </div>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {row.company}
              </span>
            </div>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        minWidth: 120,
        sortable: true,
        render: (row) =>
          row.status ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-medium capitalize"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                background: "var(--bg-elevated)",
              }}
            >
              {row.status.replace(/_/g, " ")}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          ),
      },
      {
        key: "platform",
        label: "Platform",
        minWidth: 120,
        sortable: true,
        render: (row) =>
          row.platformLabel ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-medium"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                background: "var(--bg-elevated)",
              }}
            >
              {row.platformLabel}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          ),
      },
      {
        key: "clientSince",
        label: "Since",
        minWidth: 80,
        sortable: true,
        render: (row) =>
          row.clientSince ? (
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {new Date(row.clientSince).getFullYear()}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          ),
      },
      {
        key: "leads",
        label: "Leads",
        minWidth: 100,
        sortable: false,
        render: (row) =>
          row.leads && row.leads.length > 0 ? (
            <div className="flex items-center">
              {row.leads.map((lead, i) => (
                <div
                  key={lead.userId}
                  title={lead.name}
                  className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                  style={{
                    background: accentColor(lead.name),
                    marginLeft: i === 0 ? 0 : "-5px",
                    outline: "2px solid var(--bg-surface)",
                    zIndex: i,
                  }}
                >
                  {lead.image ? (
                    <Image
                      src={lead.image}
                      alt={lead.name}
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    leadInitials(lead.name)
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      rows={sorted}
      getRowKey={(row) => row.id}
      sort={sort}
      onSort={onSort}
      onRowClick={(row) => router.push(`/clients/${row.id}`)}
      emptyMessage="No clients"
    />
  );
}

// ── tab nav ───────────────────────────────────────────────────────────────

function ClientsTabNav({ activeTab, isAdmin }: { activeTab: string; isAdmin: boolean }) {
  const tabs = [
    { value: "all", label: "All clients", href: "/clients" },
    ...(isAdmin ? [{ value: "overview", label: "Overview", href: "/clients?tab=overview" }] : []),
  ];

  return (
    <div
      className="flex gap-0 border-b shrink-0 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {tabs.map(({ value, label, href }) => {
        const active = activeTab === value;
        return (
          <Link
            key={value}
            href={href}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

// ── page client ───────────────────────────────────────────────────────────

export default function ClientsPageClient({
  clients,
  currentUserId,
  statuses,
  platforms,
  tab,
  isAdmin,
  canCreateClient = true,
  overviewRows,
  projectsByClient,
}: {
  clients: Client[];
  currentUserId: string | null;
  statuses: ClientStatusOption[];
  platforms: ClientPlatformOption[];
  tab: string;
  isAdmin: boolean;
  canCreateClient?: boolean;
  overviewRows: OverviewRow[];
  projectsByClient: Record<string, Project[]>;
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(["active", "sleeper"]));
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());

  const isOverview = isAdmin && tab === "overview";
  const activeTab = isOverview ? "overview" : "all";

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, slug: string) {
    const next = new Set(set);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setFn(next);
  }

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const statusMatch =
        selectedStatuses.size === 0 || (c.status ? selectedStatuses.has(c.status) : false);
      const platformMatch =
        selectedPlatforms.size === 0 || (c.platform ? selectedPlatforms.has(c.platform) : false);
      return statusMatch && platformMatch;
    });
  }, [clients, selectedStatuses, selectedPlatforms]);

  const myClients = currentUserId
    ? clients
        .filter((c) => c.leads?.some((l) => l.userId === currentUserId))
        .sort((a, b) => a.company.localeCompare(b.company))
    : [];
  const otherClients = currentUserId
    ? filtered.filter((c) => !c.leads?.some((l) => l.userId === currentUserId))
    : filtered;

  const hasSections = currentUserId
    ? clients.some((c) => c.leads?.some((l) => l.userId === currentUserId))
    : false;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }}>
              Clients
            </h1>
            {!isOverview && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {clients.length} {clients.length === 1 ? "client" : "clients"}
              </p>
            )}
          </div>
          {canCreateClient && <AddClientButton />}
        </div>
        <ClientsTabNav activeTab={activeTab} isAdmin={isAdmin} />
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {isOverview ? (
          <div className="space-y-6">
            <ClientsTimeline clients={clients} projectsByClient={projectsByClient} pxPerDay={12} />
            <ClientsOverviewTable rows={overviewRows} statusOptions={statuses} />
          </div>
        ) : (
          <>
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
            ) : hasSections ? (
              <div className="flex flex-col gap-10">
                {myClients.length > 0 && (
                  <section>
                    <h2 className="typo-section-title mb-4" style={{ color: "var(--text-secondary)" }}>
                      Your clients
                    </h2>
                    <SectionGrid clients={myClients} />
                  </section>
                )}
                <section>
                  <h2
                    className="typo-section-title mb-4"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {myClients.length > 0 ? "Other clients" : "Clients"}
                  </h2>
                  {(statuses.length > 0 || platforms.length > 0) && (
                    <div className="flex items-center gap-6 mb-4 flex-wrap">
                      <FilterChips
                        label="Status"
                        options={statuses}
                        selected={selectedStatuses}
                        onToggle={(slug) => toggle(selectedStatuses, setSelectedStatuses, slug)}
                      />
                      <FilterChips
                        label="Platform"
                        options={platforms}
                        selected={selectedPlatforms}
                        onToggle={(slug) => toggle(selectedPlatforms, setSelectedPlatforms, slug)}
                      />
                    </div>
                  )}
                  {otherClients.length > 0 ? (
                    <OtherClientsTable clients={otherClients} />
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                        No clients match these filters
                      </p>
                      <button
                        type="button"
                        className="text-sm mt-2 btn-link"
                        onClick={() => {
                          setSelectedStatuses(new Set());
                          setSelectedPlatforms(new Set());
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <SectionGrid clients={[...filtered].sort((a, b) => a.company.localeCompare(b.company))} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
