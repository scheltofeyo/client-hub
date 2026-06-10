"use client";

import { FolderKanban } from "lucide-react";
import DayPanel from "./DayPanel";
import EventRow from "./EventRow";
import type { WeekCalendarItem } from "@/lib/utils";

interface Props {
  items: WeekCalendarItem[];
}

export default function ProjectEventsColumn({ items }: Props) {
  return (
    <DayPanel
      title="Project events"
      icon={FolderKanban}
      count={items.length}
      isEmpty={items.length === 0}
      emptyIcon={FolderKanban}
      emptyLabel="No project events"
    >
      <div className="-mx-1 space-y-0.5">
        {items.map((item) => (
          <EventRow key={item.id} item={item} />
        ))}
      </div>
    </DayPanel>
  );
}
