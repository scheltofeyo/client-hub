import FinancePanelNav from "@/components/layout/FinancePanelNav";
import { Suspense } from "react";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <Suspense fallback={null}>
        <FinancePanelNav />
      </Suspense>
      <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
