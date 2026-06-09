"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { ReleaseNote } from "@/types";
import WhatsNewModal from "./WhatsNewModal";

export default function WhatsNewMoreInfoButton({ releaseNote }: { releaseNote: ReleaseNote }) {
  const [open, setOpen] = useState(false);

  if (!releaseNote.whatsNew) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-border border inline-flex items-center gap-1.5 text-xs"
      >
        <Sparkles size={12} />
        Meer info
      </button>
      <WhatsNewModal open={open} onClose={() => setOpen(false)} releaseNote={releaseNote} />
    </>
  );
}
