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
      className="flex-1 overflow-y-auto p-8 space-y-6"
      style={{ background: "var(--bg-surface)" }}
    >
      <WeekHeader weekOffset={weekOffset} weekLabel={weekLabel} />
      {weekContentSlot}
      {ganttSlot}
    </div>
  );
}
