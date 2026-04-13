import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const errorMessages: Record<string, string> = {
  "not-invited": "Your account hasn\u2019t been set up yet. Contact your administrator.",
  "account-inactive": "Your account has been deactivated. Contact your administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const { callbackUrl, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-app)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-xl"
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
            Client Hub
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Sign in to your workspace
          </p>
        </div>

        {errorMessage && (
          <div
            className="mb-6 rounded-lg px-4 py-3 text-sm text-center"
            style={{
              background: "var(--danger-light)",
              color: "var(--danger)",
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl ?? "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
            style={{
              background: "var(--bg-sidebar)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
