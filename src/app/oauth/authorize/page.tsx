import { headers } from "next/headers";
import { Check, Plug, ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { permissionLabel } from "@/lib/permissions";
import { connectDB } from "@/lib/mongodb";
import { OAuthClientModel } from "@/lib/models/OAuthClient";
import { hubOrigin, mcpResource, resourceMatches, signConsent } from "@/lib/oauth";
import {
  BASELINE_ACCESS_LABEL,
  MCP_SCOPES,
  isLeadOnlyScope,
  mayDelegateScope,
  parseScopeParam,
} from "@/lib/mcp/scopes";
import SummMark from "@/components/ui/SummMark";
import UserAvatar from "@/components/ui/UserAvatar";

/**
 * The consent screen — the one step of the OAuth flow that must happen in a
 * signed-in browser.
 *
 * A logged-out visitor never reaches the body of this page: the middleware gate
 * in auth.config.ts bounces them to /login with the full URL as callbackUrl,
 * and the login page already re-roots absolute callbacks onto our own origin,
 * so they land back here after Google with every query parameter intact.
 *
 * Approving posts to /api/oauth/authorize, which mints the code and redirects.
 * Everything the decision depends on travels in one signed `consent` blob
 * rather than a set of hidden inputs — see signConsent() for why.
 */

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * A problem the user can read, shown in place of the consent form.
 *
 * Rendered here rather than redirected back to the client on purpose: these are
 * all faults in the request itself (unknown client, redirect target that does
 * not match what was registered), and bouncing an error to an unverified
 * redirect_uri is exactly the open-redirect hole OAuth servers are warned
 * about. Only errors raised *after* the redirect target is verified may travel
 * back to the client.
 */
function Problem({ title, detail }: { title: string; detail: string }) {
  return (
    <Shell>
      <div className="text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
          style={{ background: "var(--danger-light)" }}
        >
          <ShieldAlert size={22} style={{ color: "var(--danger)" }} />
        </div>
        <h1 className="typo-modal-title mb-2" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        <p className="typo-body-sm" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{ backgroundColor: "var(--bg-app)", backgroundImage: "var(--login-bg-mesh)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-no-repeat bg-center bg-cover"
        style={{
          backgroundImage: "url(/login-bg.svg)",
          opacity: "var(--login-bg-opacity)",
        }}
      />
      <div
        className="relative w-full max-w-md rounded-2xl p-8"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sheet)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();

  // The middleware only checks that a session cookie decodes; a deactivated
  // user still has one, with a blank userId.
  if (!session?.user?.id) {
    return (
      <Problem
        title="Je bent niet ingelogd"
        detail="Log opnieuw in bij SUMM Hub en probeer daarna de app nogmaals te koppelen."
      />
    );
  }

  // Connecting an app is the same capability as minting a personal token — it
  // hands a machine the ability to act as you — so it reuses that permission
  // rather than introducing a second, subtly different one.
  if (!hasPermission(session, "integrations.tokens")) {
    return (
      <Problem
        title="Geen toegang tot integraties"
        detail="Je rol mag geen apps koppelen. Vraag een beheerder om de rechten voor integraties."
      />
    );
  }

  const clientId = one(params, "client_id");
  const redirectUri = one(params, "redirect_uri");
  const responseType = one(params, "response_type");
  const codeChallenge = one(params, "code_challenge");
  const codeChallengeMethod = one(params, "code_challenge_method");
  const resource = one(params, "resource");
  const state = one(params, "state") ?? undefined;

  if (!clientId || !redirectUri) {
    return (
      <Problem
        title="Onvolledig verzoek"
        detail="De app stuurde geen client_id of redirect_uri mee. Verwijder de connector en voeg hem opnieuw toe."
      />
    );
  }

  await connectDB();
  const client = await OAuthClientModel.findOne({ clientId }).lean();
  if (!client) {
    return (
      <Problem
        title="Onbekende app"
        detail="Deze app is niet bij SUMM Hub geregistreerd. Verwijder de connector en voeg hem opnieuw toe."
      />
    );
  }

  // Exact match, never a prefix. A prefix match is the classic way an
  // authorization code ends up at an attacker-controlled path on an otherwise
  // legitimate host.
  if (!client.redirectUris.includes(redirectUri)) {
    return (
      <Problem
        title="Onbekend terugkeeradres"
        detail="Het opgegeven redirect_uri hoort niet bij deze app, dus we sturen de toegangscode nergens heen."
      />
    );
  }

  const origin = hubOrigin(await headers());

  // From here on the redirect target is verified, so a spec-shaped error could
  // safely travel back to the client. These three are still shown here because
  // they mean the connector is misconfigured in a way retrying will not fix,
  // and a readable sentence beats a silent bounce.
  if (responseType !== "code") {
    return (
      <Problem
        title="Niet-ondersteund verzoek"
        detail="SUMM Hub ondersteunt alleen de authorization code flow."
      />
    );
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return (
      <Problem
        title="Beveiliging ontbreekt"
        detail="Deze app vroeg toegang zonder PKCE (S256). Dat staat SUMM Hub niet toe."
      />
    );
  }
  if (!resourceMatches(resource, origin)) {
    return (
      <Problem
        title="Verkeerde bestemming"
        detail="De app vroeg een token aan voor een andere server dan deze. Er wordt niets uitgegeven."
      />
    );
  }

  // What the client asked for, narrowed to what this person can actually
  // delegate. Anything they do not hold is shown greyed out rather than
  // silently dropped, so the mismatch is visible instead of mysterious.
  const requested = parseScopeParam(one(params, "scope"));
  const asked = requested.length > 0 ? requested : MCP_SCOPES;
  const granted = asked.filter((scope) => mayDelegateScope(session, scope));
  const withheld = asked.filter((scope) => !granted.includes(scope));

  // Split for rendering only — the signed blob carries the union, and the
  // decide route re-derives this split itself rather than trusting it. A
  // lead-only right reaches just the clients this person leads, which has to be
  // said before it is approved, not discovered afterwards.
  const leadOnly = granted.filter((scope) => isLeadOnlyScope(session, scope));
  const full = granted.filter((scope) => !leadOnly.includes(scope));

  const consent = signConsent({
    userId: session.user.id,
    clientId,
    clientName: client.clientName,
    redirectUri,
    scopes: granted,
    codeChallenge,
    resource: mcpResource(origin),
    state,
  });

  return (
    <Shell>
      <div className="flex items-center justify-center gap-3 mb-6">
        <div
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
          style={{ background: "var(--primary-light)" }}
        >
          <SummMark size={22} />
        </div>
        <div className="h-px w-8" style={{ background: "var(--border)" }} />
        <div
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
          style={{ background: "var(--bg-neutral)" }}
        >
          <Plug size={20} style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      <h1 className="typo-modal-title text-center mb-1" style={{ color: "var(--text-primary)" }}>
        {client.clientName} koppelen
      </h1>
      <p className="typo-body-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
        Deze app krijgt namens jou toegang tot SUMM Hub.
      </p>

      <div
        className="flex items-center gap-2.5 rounded-card px-3 py-2.5 mb-5"
        style={{ background: "var(--bg-tinted)" }}
      >
        <UserAvatar name={session.user.name ?? ""} image={session.user.image} size={28} />
        <div className="min-w-0">
          <p className="typo-card-title truncate" style={{ color: "var(--text-primary)" }}>
            {session.user.name}
          </p>
          <p className="typo-caption truncate">{session.user.email}</p>
        </div>
      </div>

      <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
        Wat de app mag
      </p>
      <ul className="space-y-1.5 mb-2">
        {/*
          Listed first and unconditionally: a handful of tools carry no
          permission, so this much comes with any connection whatever it was
          granted. Showing it only when nothing else was granted made the list
          read as exhaustive when it was not — see BASELINE_ACCESS_LABEL.
          Styled like the rest on purpose: playing it down would understate
          what is being handed over, which is the thing this line exists to fix.
        */}
        <li className="flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
          <span className="typo-body-sm" style={{ color: "var(--text-primary)" }}>
            {BASELINE_ACCESS_LABEL}
          </span>
        </li>
        {full.map((scope) => (
          <li key={scope} className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
            <span className="typo-body-sm" style={{ color: "var(--text-primary)" }}>
              {permissionLabel(scope)}
            </span>
          </li>
        ))}
      </ul>

      {leadOnly.length > 0 && (
        <>
          <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
            Alleen op klanten waar jij lead van bent
          </p>
          <ul className="space-y-1.5 mb-2">
            {leadOnly.map((scope) => (
              <li key={scope} className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                <span className="typo-body-sm" style={{ color: "var(--text-primary)" }}>
                  {permissionLabel(scope)}
                </span>
              </li>
            ))}
          </ul>
          <p className="typo-caption mb-2">
            Je rol heeft deze rechten niet in het algemeen — de app krijgt ze alleen op de
            klanten waar jij als lead aan gekoppeld staat.
          </p>
        </>
      )}

      {withheld.length > 0 && (
        <p className="typo-caption mb-2">
          Niet meegegeven, omdat je rol dit zelf niet heeft:{" "}
          {withheld.map(permissionLabel).join(", ")}.
        </p>
      )}

      <p className="typo-caption mb-6">
        De app kan nooit meer dan jij zelf mag, en je kunt de koppeling op elk moment
        intrekken bij je profiel.
      </p>

      <form method="POST" action="/api/oauth/authorize" className="flex gap-2">
        <input type="hidden" name="consent" value={consent} />
        <button
          type="submit"
          name="decision"
          value="deny"
          className="btn-border border flex-1 justify-center"
        >
          Weigeren
        </button>
        <button
          type="submit"
          name="decision"
          value="allow"
          className="btn-primary flex-1 justify-center"
        >
          Toestaan
        </button>
      </form>
    </Shell>
  );
}
