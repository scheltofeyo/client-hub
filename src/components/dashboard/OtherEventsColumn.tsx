"use client";

import { CalendarDays } from "lucide-react";
import DayPanel from "./DayPanel";
import EventRow from "./EventRow";
import type { WeekCalendarItem } from "@/lib/utils";

interface Props {
  items: WeekCalendarItem[];
}

export default function OtherEventsColumn({ items }: Props) {
  return (
    <DayPanel
      title="Events & tasks"
      icon={CalendarDays}
      count={items.length}
      isEmpty={items.length === 0}
      emptyIcon={CalendarDays}
      emptyLabel="Nothing scheduled"
    >
      <div className="-mx-1 space-y-0.5">
        {items.map((item) => (
          <EventRow key={item.id} item={item} showMeta />
        ))}
      </div>
    </DayPanel>
  );
}
