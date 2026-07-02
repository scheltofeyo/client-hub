import { Suspense } from "react";
import { signIn } from "@/auth";
import LoginForm from "./LoginForm";
import SummMark from "@/components/ui/SummMark";

// This page is intentionally static: it reads no session and no searchParams
// on the server, so it prerenders at build time and is served from the CDN —
// no serverless function on the cold morning path. Signed-in users never see
// it: the middleware (`authorized` in src/auth.config.ts) redirects them to
// /my-day at the edge. The error banner and callbackUrl are handled
// client-side in <LoginForm>.
export default function LoginPage() {
  async function signInAction(formData: FormData) {
    "use server";
    const raw = formData.get("callbackUrl");
    // Only allow same-app relative paths — anything else falls back to My Day
    // so the hidden input can't be abused as an open redirect. The fallback
    // carries ?welcome=1 (a fresh login, not a mid-session re-auth), which
    // triggers the WelcomeOverlay branded moment exactly once.
    const callbackUrl =
      typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/my-day?welcome=1";
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
