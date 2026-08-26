"use client";

import { useEffect, useState } from "react";
import { Plug, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { permissionLabel } from "@/lib/permissions";

/**
 * Apps connected over OAuth — in practice the Claude app's custom connector.
 *
 * The sibling of ApiTokensSection, and deliberately read-only: a connection is
 * created by the app asking for consent, never from here. All this surface has
 * to do is make an existing connection visible and revocable, which is the
 * half of the flow the OAuth handshake cannot provide.
 */

interface GrantRecord {
  id: string;
  clientName: string;
  scopes: string[];
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt?: string;
}

export default function ConnectedAppsSection() {
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/oauth/grants")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: GrantRecord[]) => setGrants(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function revoke(grant: GrantRecord) {
    if (
      !confirm(
        `De koppeling met "${grant.clientName}" verbreken? De app verliest onmiddellijk toegang.`
      )
    )
      return;
    const res = await fetch(`/api/oauth/grants/${grant.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setGrants((prev) =>
      prev.map((g) => (g.id === grant.id ? { ...g, revokedAt: new Date().toISOString() } : g))
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="typo-caption mb-4">
        Apps die je via een koppeling toegang hebt gegeven, zoals de Claude-app. Ze handelen
        namens jou en kunnen nooit meer dan je rol toestaat. Verbreek je de koppeling, dan stopt
        de app direct met werken.
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
      ) : grants.length === 0 ? (
        <div
          className="rounded-card border p-8 text-center"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <Plug
            size={24}
            strokeWidth={1.5}
            className="mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="typo-card-title mb-1" style={{ color: "var(--text-primary)" }}>
            Nog geen gekoppelde apps
          </p>
          <p className="typo-caption">
            Voeg SUMM Hub toe als connector in de Claude-app; de koppeling verschijnt hier zodra
            je hem toestaat.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="rounded-card border px-4 py-3 flex items-center gap-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface)",
                opacity: grant.revokedAt ? 0.6 : 1,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="typo-card-title truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {grant.clientName}
                  </span>
                  {grant.revokedAt && (
                    <span
                      className="typo-tag rounded-badge px-1.5 py-0.5"
                      style={{ background: "var(--bg-neutral)", color: "var(--text-muted)" }}
                    >
                      Verbroken
                    </span>
                  )}
                  {grant.scopes.length > 0 && (
                    <span
                      className="typo-tag rounded-badge px-1.5 py-0.5"
                      style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      title={grant.scopes.map(permissionLabel).join(", ")}
                    >
                      {grant.scopes.length} recht{grant.scopes.length === 1 ? "" : "en"}
                    </span>
                  )}
                </div>
                <p className="typo-caption">
                  {grant.createdAt && `Gekoppeld ${fmtDate(grant.createdAt)}`}
                  {grant.lastUsedAt
                    ? ` · Laatst gebruikt ${fmtDate(grant.lastUsedAt)}`
                    : " · Nog niet gebruikt"}
                </p>
              </div>
              {!grant.revokedAt && (
                <button
                  onClick={() => revoke(grant)}
                  className="btn-icon-danger shrink-0"
                  aria-label={`Koppeling met ${grant.clientName} verbreken`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
