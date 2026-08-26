import SalesPanelNav from "@/components/layout/SalesPanelNav";
import { Suspense } from "react";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <Suspense fallback={null}>
        <SalesPanelNav />
      </Suspense>
      <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
