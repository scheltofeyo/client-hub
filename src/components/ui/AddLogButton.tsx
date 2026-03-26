"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import { LogForm } from "@/components/ui/LogbookTab";
import type { Contact, LogSignal } from "@/types";

export default function AddLogButton({
  clientId,
  clientName,
  contacts,
  signals,
  currentUserName,
}: {
  clientId: string;
  clientName: string;
  contacts: Contact[];
  signals: LogSignal[];
  currentUserName: string;
}) {
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();

  function open() {
    openPanel(
      "New log entry",
      <LogForm
        clientId={clientId}
        clientName={clientName}
        contacts={contacts}
        signals={signals}
        currentUserName={currentUserName}
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
      Add log
    </button>
  );
}
