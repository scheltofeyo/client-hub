"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import EditClientButton from "@/components/ui/EditClientButton";
import ContactsSection from "@/components/ui/ContactsSection";
import LeadsSection from "@/components/ui/LeadsSection";
import { SettingsSkeleton } from "@/components/ui/TabSkeletons";
import { fmtDate } from "@/lib/utils";
import type { Archetype, Client } from "@/types";

export default function SettingsTab({
  client,
  section,
  isAdmin,
  canEdit,
  canAssignLeads,
  canDeleteClient,
  allUsers,
}: {
  client: Client;
  section: string;
  isAdmin: boolean;
  canEdit: boolean;
  canAssignLeads: boolean;
  canDeleteClient: boolean;
  allUsers: { id: string; name: string; email: string; image: string | null }[];
}) {
  const [archetypes, setArchetypes] = useState<Archetype[] | null>(null);

  useEffect(() => {
    fetch("/api/archetypes")
      .then((r) => r.json())
      .then((data) => setArchetypes(data))
      .catch(() => setArchetypes([]));
  }, []);

  if (section === "leads") {
    return (
      <div className="max-w-2xl space-y-8">
        <LeadsSection
          clientId={client.id}
          initialLeads={client.leads ?? []}
          allUsers={allUsers}
          isAdmin={canAssignLeads}
        />
      </div>
    );
  }

  if (section === "contacts") {
    return (
      <div className="max-w-2xl space-y-8">
        <ContactsSection
          clientId={client.id}
          initialContacts={client.contacts ?? []}
        />
      </div>
    );
  }

  if (section === "platform") {
    return <PlatformSection client={client} />;
  }

  if (!archetypes) return <SettingsSkeleton />;

  return <CompanySection client={client} canEdit={canEdit} archetypes={archetypes} isAdmin={isAdmin} canDeleteClient={canDeleteClient} />;
}

function CompanySection({ client, canEdit, archetypes, isAdmin, canDeleteClient }: { client: Client; canEdit: boolean; archetypes: Archetype[]; isAdmin: boolean; canDeleteClient: boolean }) {
  const details: [string, string | undefined][] = [
    ["Website", client.website],
    ["Employees", client.employees != null ? client.employees.toLocaleString() : undefined],
    ["Archetype", client.archetype],
    ["Client since", fmtDate(client.clientSince ?? client.createdAt)],
    ["Projects", String(client.projects?.length ?? 0)],
  ];
  const visibleDetails = details.filter(([, v]) => v !== undefined);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
            Company
          </h2>
          {canEdit && <EditClientButton client={client} archetypes={archetypes} isAdmin={isAdmin} canDelete={canDeleteClient} />}
        </div>

        <div className="space-y-1.5">
          <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
            {client.company}
          </p>
          {client.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {client.description}
            </p>
          )}
        </div>

        {visibleDetails.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {visibleDetails.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</dt>
                <dd className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {label === "Website" && value ? (
                    <a
                      href={value.startsWith("http") ? value : `https://${value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 btn-link"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
            {client.status && (
              <div>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Status</dt>
                <dd><StatusBadge status={client.status} /></dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function PlatformSection({ client }: { client: Client }) {
  const platformLabel = client.platformLabel ?? null;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          Platform
        </h2>

        {platformLabel ? (
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {platformLabel}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No platform set
          </p>
        )}
      </div>
    </div>
  );
}
