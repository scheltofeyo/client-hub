import { Suspense } from "react";
import { signIn } from "@/auth";
import LoginForm from "./LoginForm";
import SummMark from "@/components/ui/SummMark";

// Rendered per-request instead of prerendered-and-CDN-cached. As a static page
// this was the auth flow's cached entry point, and its HTML embeds the build's
// content-hashed chunk URLs — so after a deploy a returning browser (or a
// not-yet-purged CDN node) would serve the previous build's /login, whose
// chunks the new build had replaced → ChunkLoadError → the root error screen.
// `force-dynamic` keeps the login HTML pinned to the current build. The render
// is trivial (no session, no DB, no searchParams on the server), so the cost is
// a bare function invocation. Signed-in users never reach it: the middleware
// (`authorized` in src/auth.config.ts) redirects them to /my-day at the edge.
// The error banner and callbackUrl are handled client-side in <LoginForm>.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  async function signInAction(formData: FormData) {
    "use server";
    const raw = formData.get("callbackUrl");
    // Auth.js middleware puts the ABSOLUTE request URL in callbackUrl when it
    // bounces a logged-out deep link to /login, so absolute values must be
    // honored too — but only their path+query+hash, re-rooted on our own
    // origin. That keeps the hidden input useless as an open redirect
    // (https://evil.com/x just becomes local /x) without needing an env-based
    // origin comparison. Anything unparsable falls back to My Day. The
    // WelcomeOverlay branded moment is triggered by the first My Day view of
    // the browser session (see WelcomeOverlay.tsx), not by a login-only param.
    let callbackUrl = "/my-day";
    if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
      callbackUrl = raw;
    } else if (typeof raw === "string" && raw) {
      try {
        const url = new URL(raw);
        callbackUrl = url.pathname + url.search + url.hash;
      } catch {
        // keep the /my-day fallback
      }
    }
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-app)",
        backgroundImage: "var(--login-bg-mesh)",
      }}
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
        className="relative w-full max-w-sm rounded-2xl p-8 shadow-xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: "var(--primary-light)" }}
          >
            <SummMark size={24} />
          </div>
          <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }}>
            SUMM Hub
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Sign in to your workspace
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm signInAction={signInAction} />
        </Suspense>
      </div>
    </div>
  );
}
