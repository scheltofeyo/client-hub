import WeekHeader from "./WeekHeader";
import type { ReactNode } from "react";

interface Props {
  weekOffset: number;
  weekLabel: string;
  weekContentSlot: ReactNode;
  ganttSlot: ReactNode;
}

export default function ThisWeekDashboard({
  weekOffset,
  weekLabel,
  weekContentSlot,
  ganttSlot,
}: Props) {
  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: "var(--bg-tinted)" }}
    >
      <div className="mx-auto w-full max-w-[1400px] px-6 py-7 sm:px-8 space-y-6">
        <WeekHeader weekOffset={weekOffset} weekLabel={weekLabel} />
        {weekContentSlot}
        {ganttSlot}
      </div>
    </div>
  );
}
