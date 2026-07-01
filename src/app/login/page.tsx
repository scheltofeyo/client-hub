import { Suspense } from "react";
import { signIn } from "@/auth";
import LoginForm from "./LoginForm";

// This page is intentionally static: it reads no session and no searchParams
// on the server, so it prerenders at build time and is served from the CDN —
// no serverless function on the cold morning path. Signed-in users never see
// it: the middleware (`authorized` in src/auth.config.ts) redirects them to
// /dashboard at the edge. The error banner and callbackUrl are handled
// client-side in <LoginForm>.
export default function LoginPage() {
  async function signInAction(formData: FormData) {
    "use server";
    const raw = formData.get("callbackUrl");
    // Only allow same-app relative paths — anything else falls back to the
    // dashboard so the hidden input can't be abused as an open redirect.
    const callbackUrl = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="var(--primary)" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="var(--primary)" opacity="0.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="var(--primary)" opacity="0.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--primary)" />
            </svg>
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
