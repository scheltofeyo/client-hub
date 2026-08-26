"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import PanelSection from "@/components/ui/editor-panel/PanelSection";
import PrimaryColorField from "@/components/ui/PrimaryColorField";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { ACCENT_COLORS } from "@/lib/styles";
import type { Client, ClientPlatformOption, ClientStatusOption, Contact } from "@/types";

/**
 * The editable shape of a client, declared once so every create- and
 * edit-client surface renders the same fields in the same order. Everything is
 * a string because it is bound straight to inputs; `draftToPayload` converts
 * back to what the clients API expects.
 */
export interface ClientDraft {
  company: string;
  description: string;
  website: string;
  employees: string;
  status: string;
  platform: string;
  clientSince: string;
  primaryColor: string;
  addressStreet: string;
  addressPostalCode: string;
  addressCity: string;
  addressCountry: string;
  contacts: Contact[];
}

export function emptyClientDraft(overrides: Partial<ClientDraft> = {}): ClientDraft {
  return {
    company: "",
    description: "",
    website: "",
    employees: "",
    status: "",
    platform: "",
    clientSince: new Date().toISOString().split("T")[0],
    primaryColor: "",
    addressStreet: "",
    addressPostalCode: "",
    addressCity: "",
    addressCountry: "",
    contacts: [],
    ...overrides,
  };
}

export function clientToDraft(client: Client): ClientDraft {
  return {
    company: client.company ?? "",
    description: client.description ?? "",
    website: client.website ?? "",
    employees: client.employees != null ? String(client.employees) : "",
    status: client.status ?? "",
    platform: client.platform ?? "",
    clientSince: client.clientSince ?? client.createdAt ?? "",
    primaryColor: client.primaryColor ?? "",
    addressStreet: client.addressStreet ?? "",
    addressPostalCode: client.addressPostalCode ?? "",
    addressCity: client.addressCity ?? "",
    addressCountry: client.addressCountry ?? "",
    contacts: client.contacts ?? [],
  };
}

/**
 * Turn a (partial) draft into a clients-API body. Only the keys present in
 * `patch` end up in the payload, so a PATCH stays limited to what changed.
 */
export function draftToPayload(patch: Partial<ClientDraft>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const text = (v: string | undefined) => (v ?? "").trim();

  if (patch.company !== undefined) body.company = text(patch.company);
  if (patch.description !== undefined) body.description = text(patch.description);
  if (patch.website !== undefined) body.website = text(patch.website);
  if (patch.employees !== undefined) {
    body.employees = text(patch.employees) ? Number(patch.employees) : null;
  }
  if (patch.status !== undefined) body.status = text(patch.status);
  if (patch.platform !== undefined) body.platform = text(patch.platform);
  if (patch.clientSince !== undefined) body.clientSince = text(patch.clientSince);
  if (patch.primaryColor !== undefined) body.primaryColor = text(patch.primaryColor);
  if (patch.addressStreet !== undefined) body.addressStreet = text(patch.addressStreet);
  if (patch.addressPostalCode !== undefined) body.addressPostalCode = text(patch.addressPostalCode);
  if (patch.addressCity !== undefined) body.addressCity = text(patch.addressCity);
  if (patch.addressCountry !== undefined) body.addressCountry = text(patch.addressCountry);
  if (patch.contacts !== undefined) {
    body.contacts = patch.contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim(),
      role: c.role?.trim() || undefined,
      email: c.email?.trim() || undefined,
      phone: c.phone?.trim() || undefined,
    }));
  }
  return body;
}

/** Status and platform options, fetched once per mounted editor. */
export function useClientReferenceOptions() {
  const [statusOptions, setStatusOptions] = useState<ClientStatusOption[]>([]);
  const [platformOptions, setPlatformOptions] = useState<ClientPlatformOption[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/client-statuses").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/client-platforms").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([statuses, platforms]) => {
        if (!alive) return;
        setStatusOptions(statuses);
        setPlatformOptions(platforms);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return { statusOptions, platformOptions };
}

// ── General fields ───────────────────────────────────────────────────

/**
 * The company half of the client editor. `statusLocked` replaces the status
 * picker with a read-only badge: on the sales board a client's status is owned
 * by the won/lost flow, so a free dropdown there would only be a way to get the
 * board out of sync.
 */
export function ClientGeneralFields({
  draft,
  onChange,
  statusOptions,
  platformOptions,
  statusLocked,
  disabled,
}: {
  draft: ClientDraft;
  onChange: <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) => void;
  statusOptions: ClientStatusOption[];
  platformOptions: ClientPlatformOption[];
  statusLocked?: boolean;
  disabled?: boolean;
}) {
  const statusLabel = draft.status
    ? statusOptions.find((s) => s.slug === draft.status)?.label ?? draft.status
    : "Geen status";

  return (
    <>
      <PanelSection title="Bedrijf">
        <div>
          <label htmlFor="cf-company" className="typo-label">
            Bedrijfsnaam <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            id="cf-company"
            type="text"
            value={draft.company}
            onChange={(e) => onChange("company", e.target.value)}
            disabled={disabled}
            placeholder="Acme Corp"
            autoFocus
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="cf-description" className="typo-label">
            Omschrijving
          </label>
          <textarea
            id="cf-description"
            value={draft.description}
            onChange={(e) => onChange("description", e.target.value)}
            disabled={disabled}
            placeholder="Wat doet dit bedrijf?"
            rows={3}
            className={inputClass + " resize-none"}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cf-website" className="typo-label">
              Website
            </label>
            <input
              id="cf-website"
              type="text"
              value={draft.website}
              onChange={(e) => onChange("website", e.target.value)}
              disabled={disabled}
              placeholder="acme.com"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="cf-employees" className="typo-label">
              Medewerkers
            </label>
            <input
              id="cf-employees"
              type="number"
              min={1}
              value={draft.employees}
              onChange={(e) => onChange("employees", e.target.value)}
              disabled={disabled}
              placeholder="bijv. 50"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cf-status" className="typo-label">
              Status
            </label>
            {statusLocked ? (
              <p
                className="rounded-badge inline-flex items-center px-2.5 py-1 typo-caption"
                style={{ background: "var(--bg-neutral)", color: "var(--text-primary)" }}
              >
                {statusLabel}
              </p>
            ) : (
              <select
                id="cf-status"
                value={draft.status}
                onChange={(e) => onChange("status", e.target.value)}
                disabled={disabled}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— Geen —</option>
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="cf-platform" className="typo-label">
              Platform
            </label>
            <select
              id="cf-platform"
              value={draft.platform}
              onChange={(e) => onChange("platform", e.target.value)}
              disabled={disabled}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Niet op platform</option>
              {platformOptions.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="cf-client-since" className="typo-label">
            Klant sinds
          </label>
          <input
            id="cf-client-since"
            type="date"
            value={draft.clientSince}
            onChange={(e) => onChange("clientSince", e.target.value)}
            disabled={disabled}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </PanelSection>

      <PanelSection title="Adres" description="Gebruikt op voorstellen.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cf-street" className="typo-label">
              Straat + nr
            </label>
            <input
              id="cf-street"
              type="text"
              value={draft.addressStreet}
              onChange={(e) => onChange("addressStreet", e.target.value)}
              disabled={disabled}
              placeholder="Voorbeeldstraat 1"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="cf-postal" className="typo-label">
              Postcode
            </label>
            <input
              id="cf-postal"
              type="text"
              value={draft.addressPostalCode}
              onChange={(e) => onChange("addressPostalCode", e.target.value)}
              disabled={disabled}
              placeholder="1234 AB"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="cf-city" className="typo-label">
              Plaats
            </label>
            <input
              id="cf-city"
              type="text"
              value={draft.addressCity}
              onChange={(e) => onChange("addressCity", e.target.value)}
              disabled={disabled}
              placeholder="Amsterdam"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="cf-country" className="typo-label">
              Land
            </label>
            <input
              id="cf-country"
              type="text"
              value={draft.addressCountry}
              onChange={(e) => onChange("addressCountry", e.target.value)}
              disabled={disabled}
              placeholder="Nederland"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Huisstijl">
        <PrimaryColorField
          company={draft.company}
          value={draft.primaryColor}
          onChange={(v) => onChange("primaryColor", v)}
          disabled={disabled}
        />
      </PanelSection>
    </>
  );
}

// ── Contact fields ───────────────────────────────────────────────────

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

function contactInitials(contact: Contact): string {
  const letters = `${contact.firstName.charAt(0)}${contact.lastName.charAt(0)}`.trim();
  return letters ? letters.toUpperCase() : "?";
}

function contactLabel(contact: Contact): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || "Naamloze contactpersoon";
}

/**
 * Contact persons as part of the surrounding draft: rows expand in place and
 * every keystroke lands in the draft, so one Save persists company details and
 * contacts together.
 */
export function ClientContactsFields({
  contacts,
  onChange,
  disabled,
}: {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void;
  disabled?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  function addContact() {
    const contact: Contact = { id: crypto.randomUUID(), firstName: "", lastName: "" };
    onChange([...contacts, contact]);
    setOpenId(contact.id);
  }

  function updateContact(id: string, patch: Partial<Contact>) {
    onChange(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeContact(id: string) {
    onChange(contacts.filter((c) => c.id !== id));
    if (openId === id) setOpenId(null);
  }

  return (
    <PanelSection
      title="Contactpersonen"
      description="Wijzigingen worden opgeslagen met de rest van dit formulier."
      action={
        !disabled && (
          <button type="button" onClick={addContact} className="btn-tertiary inline-flex items-center gap-1">
            <Plus size={12} />
            Contactpersoon
          </button>
        )
      }
    >
      {contacts.length === 0 ? (
        <p className="typo-caption">Nog geen contactpersonen.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const expanded = openId === contact.id;
            return (
              <div
                key={contact.id}
                className="rounded-card border overflow-hidden"
                style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
              >
                <div className="flex items-center gap-3 p-3">
                  <span
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-semibold"
                    style={{ background: avatarColor(contact.id) }}
                  >
                    {contactInitials(contact)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : contact.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="typo-card-title truncate" style={{ color: "var(--text-primary)" }}>
                      {contactLabel(contact)}
                    </p>
                    <p className="typo-caption truncate">
                      {[contact.role, contact.email].filter(Boolean).join(" · ") || "Geen functie of e-mail"}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : contact.id)}
                    className="btn-icon p-1 shrink-0"
                    aria-label={expanded ? "Inklappen" : "Bewerken"}
                    aria-expanded={expanded}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeContact(contact.id)}
                      className="btn-icon p-1 shrink-0 hover:!text-[var(--danger)]"
                      aria-label={`${contactLabel(contact)} verwijderen`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: "var(--border)" }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="typo-label">
                          Voornaam <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          type="text"
                          value={contact.firstName}
                          onChange={(e) => updateContact(contact.id, { firstName: e.target.value })}
                          disabled={disabled}
                          placeholder="Jane"
                          autoFocus
                          className={inputClass}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label className="typo-label">Achternaam</label>
                        <input
                          type="text"
                          value={contact.lastName}
                          onChange={(e) => updateContact(contact.id, { lastName: e.target.value })}
                          disabled={disabled}
                          placeholder="Smith"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="typo-label">Functie</label>
                      <input
                        type="text"
                        value={contact.role ?? ""}
                        onChange={(e) => updateContact(contact.id, { role: e.target.value })}
                        disabled={disabled}
                        placeholder="CEO"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="typo-label">E-mail</label>
                        <input
                          type="email"
                          value={contact.email ?? ""}
                          onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                          disabled={disabled}
                          placeholder="jane@acme.com"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label className="typo-label">Telefoon</label>
                        <input
                          type="text"
                          value={contact.phone ?? ""}
                          onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                          disabled={disabled}
                          placeholder="+31 6 1234 5678"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PanelSection>
  );
}
