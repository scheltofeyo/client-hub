"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { fmtDate } from "@/lib/utils";
import { isTokenGrantable } from "@/lib/permissions";

interface ApiTokenRecord {
  id: string;
  name: string;
  prefix: string;
  permissions: string[] | null;
  expiresAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt?: string;
}

interface PermissionItem {
  key: string;
  label: string;
}

interface PermissionGroup {
  label: string;
  description: string;
  permissions: PermissionItem[];
}

/** Shown once, right after creation. The secret is unrecoverable afterwards. */
function SecretReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the value is selectable either way.
    }
  }

  return (
    <div
      className="rounded-card border p-4"
      style={{ borderColor: "var(--warning)", background: "var(--warning-light)" }}
    >
      <p className="typo-card-title mb-1" style={{ color: "var(--text-primary)" }}>
        Kopieer dit token nu
      </p>
      <p className="typo-caption mb-3">
        Dit is de enige keer dat je het te zien krijgt. Sluit je dit venster, dan is het weg en
        moet je een nieuw token aanmaken.
      </p>
      <div className="flex items-center gap-2">
        <code
          className="flex-1 min-w-0 text-xs font-mono break-all rounded-lg px-3 py-2"
          style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}
        >
          {token}
        </code>
        <button onClick={copy} className="btn-icon shrink-0" aria-label="Token kopiëren">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function NewTokenForm({
  onCreated,
  onClose,
}: {
  onCreated: (record: ApiTokenRecord) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [limitScope, setLimitScope] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [ownPermissions, setOwnPermissions] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/permissions")
      .then((r) => (r.ok ? r.json() : { global: [] }))
      .then((d) => setGroups(d.global ?? []))
      .catch(() => {});
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setOwnPermissions(s?.user?.permissions ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        expiresAt: expiresAt || undefined,
        permissions: limitScope && selected.length > 0 ? selected : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Token aanmaken mislukt");
      return;
    }
    const { token, record } = await res.json();
    setSecret(token);
    onCreated(record);
  }

  if (secret) {
    return (
      <div className="space-y-4">
        <SecretReveal token={secret} />
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Klaar
          </button>
        </div>
      </div>
    );
  }

  // Two filters: you can only hand out what you hold yourself, and the admin
  // surface is never grantable to a token at all. The server enforces both
  // again on every request, so this list is a convenience, not the control.
  const grantable = groups
    .map((g) => ({
      ...g,
      permissions: g.permissions.filter(
        (p) => ownPermissions.includes(p.key) && isTokenGrantable(p.key)
      ),
    }))
    .filter((g) => g.permissions.length > 0);

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <div
        className="rounded-card border px-3 py-2.5"
        style={{ borderColor: "var(--border)", background: "var(--bg-tinted)" }}
      >
        <p className="typo-caption">
          Beheerrechten zitten nooit in een token: het adminpaneel, medewerkers, rollen en het
          aanmaken van tokens blijven voorbehouden aan een echte inlog. Verder kan een token nooit
          meer dan jouw eigen rol toestaat.
        </p>
      </div>

      <div>
        <label className="typo-label">
          Naam <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="bijv. mijn laptop, of mail-taak"
          className={inputClass}
          style={inputStyle}
        />
        <p className="typo-caption mt-1">Waar ga je dit token gebruiken? Puur ter herkenning.</p>
      </div>

      <div>
        <label className="typo-label">Vervaldatum</label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        <p className="typo-caption mt-1">Leeg laten betekent dat het token blijft werken tot je het intrekt.</p>
      </div>

      <div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={limitScope}
            onChange={(e) => setLimitScope(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="typo-body" style={{ color: "var(--text-primary)" }}>
              Rechten beperken
            </span>
            <span className="block typo-caption">
              Zonder beperking krijgt het token alles wat jouw rol mag, op beheerrechten na. Voor
              een geautomatiseerde taak is het verstandig alleen aan te vinken wat hij echt nodig
              heeft.
            </span>
          </span>
        </label>
      </div>

      {limitScope && (
        <div
          className="max-h-72 overflow-y-auto rounded-card border p-3 space-y-4"
          style={{ borderColor: "var(--border)" }}
        >
          {grantable.length === 0 ? (
            <p className="typo-caption">Je rol geeft nog geen rechten om uit te delen.</p>
          ) : (
            grantable.map((group) => (
              <div key={group.label}>
                <p className="typo-section-header mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.permissions.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.includes(perm.key)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, perm.key]
                              : prev.filter((k) => k !== perm.key)
                          )
                        }
                      />
                      <span className="typo-body-sm" style={{ color: "var(--text-primary)" }}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="btn-ghost">
          Annuleren
        </button>
        <button onClick={handleSubmit} disabled={saving || !name.trim()} className="btn-primary">
          {saving ? "Bezig…" : "Token aanmaken"}
        </button>
      </div>
    </div>
  );
}

export default function ApiTokensSection() {
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { openPanel, closePanel } = useRightPanel();

  useEffect(() => {
    fetch("/api/api-tokens")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ApiTokenRecord[]) => setTokens(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openNewToken() {
    openPanel(
      "Nieuw API-token",
      <NewTokenForm
        onCreated={(record) => setTokens((prev) => [record, ...prev])}
        onClose={closePanel}
      />
    );
  }

  async function revoke(token: ApiTokenRecord) {
    if (
      !confirm(
        `"${token.name}" intrekken? Alles wat dit token gebruikt stopt onmiddellijk met werken.`
      )
    )
      return;
    const res = await fetch(`/api/api-tokens/${token.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTokens((prev) =>
      prev.map((t) => (t.id === token.id ? { ...t, revokedAt: new Date().toISOString() } : t))
    );
  }

  function statusOf(token: ApiTokenRecord): { label: string; color: string } | null {
    if (token.revokedAt) return { label: "Ingetrokken", color: "var(--text-muted)" };
    if (token.expiresAt && token.expiresAt <= new Date().toISOString())
      return { label: "Verlopen", color: "var(--danger)" };
    return null;
  }

  return (
    <div className="max-w-2xl">
      <p className="typo-caption mb-4">
        Met een API-token kan je eigen gereedschap de hub aanroepen zonder browser, bijvoorbeeld
        Claude in een chat of een geplande taak. Het token handelt namens jou en kan nooit meer dan
        jouw rol toestaat. Acties die ermee gedaan worden verschijnen in het activiteitenoverzicht
        met de naam van het token erbij.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 rounded-card animate-pulse"
              style={{ background: "var(--bg-neutral)" }}
            />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div
          className="rounded-card border p-8 text-center"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <KeyRound
            size={24}
            strokeWidth={1.5}
            className="mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="typo-card-title mb-1" style={{ color: "var(--text-primary)" }}>
            Nog geen tokens
          </p>
          <p className="typo-caption mb-4">Maak er een aan om je eigen Claude aan de hub te koppelen.</p>
          <button onClick={openNewToken} className="btn-primary">
            <Plus size={14} className="inline mr-1.5 -mt-px" />
            Nieuw token
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {tokens.map((token) => {
              const status = statusOf(token);
              return (
                <div
                  key={token.id}
                  className="rounded-card border px-4 py-3 flex items-center gap-3"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-surface)",
                    opacity: status ? 0.6 : 1,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="typo-card-title truncate" style={{ color: "var(--text-primary)" }}>
                        {token.name}
                      </span>
                      {status && (
                        <span className="typo-tag rounded-badge px-1.5 py-0.5" style={{ background: "var(--bg-neutral)", color: status.color }}>
                          {status.label}
                        </span>
                      )}
                      {token.permissions && token.permissions.length > 0 && (
                        <span
                          className="typo-tag rounded-badge px-1.5 py-0.5"
                          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                          title={token.permissions.join(", ")}
                        >
                          {token.permissions.length} recht{token.permissions.length === 1 ? "" : "en"}
                        </span>
                      )}
                    </div>
                    <p className="typo-caption font-mono">{token.prefix}…</p>
                    <p className="typo-caption">
                      {token.createdAt && `Aangemaakt ${fmtDate(token.createdAt)}`}
                      {token.lastUsedAt
                        ? ` · Laatst gebruikt ${fmtDate(token.lastUsedAt)}`
                        : " · Nog niet gebruikt"}
                      {token.expiresAt && ` · Verloopt ${fmtDate(token.expiresAt)}`}
                    </p>
                  </div>
                  {!token.revokedAt && (
                    <button
                      onClick={() => revoke(token)}
                      className="btn-icon-danger shrink-0"
                      aria-label={`${token.name} intrekken`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={openNewToken} className="btn-tertiary mt-3">
            <Plus size={13} className="inline mr-1 -mt-px" />
            Nieuw token
          </button>
        </>
      )}
    </div>
  );
}
