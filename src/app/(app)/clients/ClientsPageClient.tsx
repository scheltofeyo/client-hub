"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import AddClientButton from "@/components/ui/AddClientButton";
import type { Client, ClientStatusOption, ClientPlatformOption } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#D97706",
  "#DC2626", "#DB2777", "#0891B2", "#0D9488",
];

function accentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

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
  const color = accentColor(client.company);
  const rgb = hexToRgb(color);
  const abbr = initials(client.company);

  return (
    <Link
      href={`/clients/${client.id}`}
      className="group flex flex-col rounded-2xl border overflow-hidden hover:shadow-lg transition-all duration-200"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div
        className="flex items-start px-4 pt-4 pb-0"
        style={{ background: `rgba(${rgb}, 0.08)`, height: "40px" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-sm mb-[-24px] z-10"
          style={{ background: color }}
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

// ── page client ───────────────────────────────────────────────────────────

export default function ClientsPageClient({
  clients,
  currentUserId,
  statuses,
  platforms,
}: {
  clients: Client[];
  currentUserId: string | null;
  statuses: ClientStatusOption[];
  platforms: ClientPlatformOption[];
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());

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
    ? filtered.filter((c) => c.leads?.some((l) => l.userId === currentUserId))
    : [];
  const otherClients = currentUserId
    ? filtered.filter((c) => !c.leads?.some((l) => l.userId === currentUserId))
    : filtered;

  const hasSections = currentUserId
    ? clients.some((c) => c.leads?.some((l) => l.userId === currentUserId))
    : false;

  const hasFilters = selectedStatuses.size > 0 || selectedPlatforms.size > 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Clients
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {hasFilters
              ? `${filtered.length} of ${clients.length} ${clients.length === 1 ? "client" : "clients"}`
              : `${clients.length} ${clients.length === 1 ? "client" : "clients"}`}
          </p>
        </div>
        <AddClientButton />
      </div>

      {/* Filters */}
      {(statuses.length > 0 || platforms.length > 0) && (
        <div className="flex flex-col gap-2 mb-6">
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

      {/* Content */}
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
      ) : filtered.length === 0 ? (
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
      ) : hasSections ? (
        <div className="flex flex-col gap-10">
          {myClients.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
                Your clients
              </h2>
              <SectionGrid clients={myClients} />
            </section>
          )}
          {otherClients.length > 0 && (
            <section>
              <h2
                className="text-sm font-semibold mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                {myClients.length > 0 ? "Other clients" : "Clients"}
              </h2>
              <SectionGrid clients={otherClients} />
            </section>
          )}
        </div>
      ) : (
        <SectionGrid clients={filtered} />
      )}
    </div>
  );
}
