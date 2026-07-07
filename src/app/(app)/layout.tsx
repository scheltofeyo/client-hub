import { Suspense } from "react";
import IconNav from "@/components/layout/IconNav";
import PanelNav from "@/components/layout/PanelNav";
import SessionProviderWrapper from "@/components/layout/SessionProviderWrapper";
import { RightPanelProvider } from "@/components/layout/RightPanel";
import WhatsNewLauncher from "@/components/ui/WhatsNewLauncher";
import WelcomeOverlay from "@/components/ui/WelcomeOverlay";
import SessionStatusPing from "@/components/layout/SessionStatusPing";
import { getSession } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `getSession()` decodes the JWT to seed SessionProviderWrapper for client
  // components. It is `auth()` wrapped in React cache(), so the page rendered
  // below this layout shares the same call instead of re-running the jwt
  // callback. The warm path is a pure in-memory JWT decode (no DB); on the
  // 15-min re-check boundary the DB work is time-boxed (see src/auth.ts).
  // The layout stays dynamic because per-user permissions in the session
  // payload make caching the rendered output across users incorrect.
  const session = await getSession();
  return (
    <SessionProviderWrapper session={session}>
      <div className="flex h-screen overflow-hidden">
        <IconNav />

        <div className="flex-1 flex flex-col pt-6 min-h-0">
          <div
            className="flex-1 flex overflow-hidden rounded-tl-2xl border-t border-l"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              boxShadow: "-4px -4px 24px 0 rgba(0,0,0,0.08)",
            }}
          >
            <PanelNav />
            <main className="flex-1 overflow-hidden flex flex-col">
              <RightPanelProvider>
                {children}
              </RightPanelProvider>
            </main>
          </div>
        </div>
      </div>
      <WhatsNewLauncher />
      <SessionStatusPing />
      {/* Post-login branded moment — useSearchParams requires the Suspense
          wrapper; renders null on every navigation without ?welcome=1 */}
      <Suspense fallback={null}>
        <WelcomeOverlay />
      </Suspense>
    </SessionProviderWrapper>
  );
}
