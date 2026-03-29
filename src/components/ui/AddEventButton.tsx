"use client";

import { Plus } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EventForm } from "@/components/ui/EventsTab";
import type { EventType } from "@/types";

export default function AddEventButton({ clientId }: { clientId: string }) {
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((data: EventType[]) => { if (Array.isArray(data)) setEventTypes(data); })
      .catch(() => {});
  }, []);

  function open() {
    openPanel(
      "New Event",
      <EventForm
        clientId={clientId}
        eventTypes={eventTypes}
        onSaved={() => router.refresh()}
        onClose={closePanel}
      />
    );
  }

  return (
    <button
      onClick={open}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
    >
      <Plus size={13} />
      Add Event
    </button>
  );
}
