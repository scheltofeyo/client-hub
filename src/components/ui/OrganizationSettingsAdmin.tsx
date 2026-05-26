"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";

interface OrgSettings {
  addressStreet: string | null;
  addressCity: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  kvkNumber: string | null;
  btwNumber: string | null;
  iban: string | null;
  website: string | null;
  email: string | null;
}

const EMPTY: OrgSettings = {
  addressStreet: null,
  addressCity: null,
  addressPostalCode: null,
  addressCountry: "Nederland",
  kvkNumber: null,
  btwNumber: null,
  iban: null,
  website: null,
  email: null,
};

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export default function OrganizationSettingsAdmin() {
  const [data, setData] = useState<OrgSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/organization-settings")
      .then((r) => r.json())
      .then((d: OrgSettings) => setData({ ...EMPTY, ...d }))
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function patch(field: keyof OrgSettings, value: string) {
    const next = { ...data, [field]: value.trim() || null };
    setData(next);
    const res = await fetch("/api/organization-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value.trim() || null }),
    });
    if (res.ok) setSavedAt(Date.now());
    else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
    }
  }

  function Input({
    label,
    field,
    required = false,
    placeholder,
  }: {
    label: string;
    field: keyof OrgSettings;
    required?: boolean;
    placeholder?: string;
  }) {
    const [local, setLocal] = useState<string>((data[field] as string | null) ?? "");
    useEffect(() => {
      setLocal((data[field] as string | null) ?? "");
    }, [field]);
    return (
      <div>
        <label className="typo-label">
          {label}
          {required && <span className="text-[var(--danger)]"> *</span>}
        </label>
        <input
          type="text"
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            if (local !== ((data[field] as string | null) ?? "")) patch(field, local);
          }}
          className={inputClass}
          style={inputStyle}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization" }]}
        title="Organization settings"
        actions={
          savedAt && (
            <span className="text-xs text-text-muted">
              Opgeslagen om {new Date(savedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-7 max-w-3xl">
          <h2 className="typo-section-title mb-2" style={{ color: "var(--text-primary)" }}>SUMM-identiteit</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Deze gegevens verschijnen op de voorpagina en de identiteitsstrook van elk voorstel-PDF.
            Verplichte velden zijn nodig voor een nette renderbare cover.
          </p>

          {error && (
            <p className="text-sm px-4 py-3 mb-4 rounded-lg bg-danger-light text-danger">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-text-muted">Laden…</p>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Straat + huisnummer" field="addressStreet" required placeholder="Voorbeeldstraat 1" />
                <Input label="Postcode" field="addressPostalCode" placeholder="1234 AB" />
                <Input label="Plaats" field="addressCity" required placeholder="Amsterdam" />
                <Input label="Land" field="addressCountry" placeholder="Nederland" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="KvK-nummer" field="kvkNumber" required placeholder="12345678" />
                <Input label="BTW-nummer" field="btwNumber" required placeholder="NL000000000B00" />
                <Input label="IBAN" field="iban" placeholder="NL00 BANK 0000 0000 00" />
                <Input label="Website" field="website" placeholder="summ.nl" />
                <Input label="E-mail" field="email" placeholder="info@summ.nl" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
