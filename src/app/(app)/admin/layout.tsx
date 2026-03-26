import AdminPanelNav from "@/components/layout/AdminPanelNav";
import { Suspense } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <Suspense fallback={null}>
        <AdminPanelNav />
      </Suspense>
      <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
