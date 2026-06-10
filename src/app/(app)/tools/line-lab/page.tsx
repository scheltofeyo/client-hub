import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import PageHeader from "@/components/layout/PageHeader";
import LineLab from "@/components/proposal/LineLab";

export const dynamic = "force-dynamic";

export default async function LineLabPage() {
  const session = await auth();
  if (!session || !hasPermission(session, "tools.lineLab.access")) {
    redirect("/tools");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Line Lab" }]}
        title="Line Lab"
      />
      <div className="flex-1 overflow-y-auto px-7 pb-12 pt-6" style={{ background: "var(--bg-tinted)" }}>
        <LineLab />
      </div>
    </div>
  );
}
