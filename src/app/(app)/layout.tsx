import IconNav from "@/components/layout/IconNav";
import PanelNav from "@/components/layout/PanelNav";
import SessionProviderWrapper from "@/components/layout/SessionProviderWrapper";
import { RightPanelProvider } from "@/components/layout/RightPanel";
import WhatsNewLauncher from "@/components/ui/WhatsNewLauncher";
import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `auth()` here decodes the JWT to seed SessionProviderWrapper for client
  // components. With the role-version shortcut in src/auth.ts the warm path
  // is a pure in-memory JWT decode (no DB), so this does not block navigation
  // in practice. The layout stays dynamic because per-user permissions in the
  // session payload make caching the rendered output across users incorrect.
  const session = await auth();
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
    </SessionProviderWrapper>
  );
}
