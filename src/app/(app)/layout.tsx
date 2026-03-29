import { auth } from "@/auth";
import { redirect } from "next/navigation";
import IconNav from "@/components/layout/IconNav";
import PanelNav from "@/components/layout/PanelNav";
import SessionProviderWrapper from "@/components/layout/SessionProviderWrapper";
import { RightPanelProvider } from "@/components/layout/RightPanel";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user?.name ?? "Unknown",
    email: session.user?.email ?? "",
    image: session.user?.image ?? null,
    isAdmin: session.user?.isAdmin ?? false,
  };

  return (
    <SessionProviderWrapper>
      <div className="flex h-screen overflow-hidden">
        <IconNav user={user} />

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
    </SessionProviderWrapper>
  );
}
