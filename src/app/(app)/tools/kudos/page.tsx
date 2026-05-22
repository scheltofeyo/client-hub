import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import PageHeader from "@/components/layout/PageHeader";
import KudosTertiaryNav from "@/components/layout/KudosTertiaryNav";
import KudosToolClient from "@/components/kudos/KudosToolClient";

export const dynamic = "force-dynamic";

const validTabs = ["feed", "dashboard"] as const;
type Tab = (typeof validTabs)[number];

export default async function KudosToolPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [resolvedParams, session] = await Promise.all([searchParams, auth()]);

  if (!hasPermission(session, "tools.kudos.access")) redirect("/tools");

  const tab = (resolvedParams?.tab ?? "feed") as Tab;
  const activeTab: Tab = validTabs.includes(tab) ? tab : "feed";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Schouderklopjes" }]}
        title="Schouderklopjes"
        tertiaryNav={
          <Suspense fallback={null}>
            <KudosTertiaryNav />
          </Suspense>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <KudosToolClient activeTab={activeTab} currentUserId={session?.user?.id ?? ""} />
      </div>
    </div>
  );
}
