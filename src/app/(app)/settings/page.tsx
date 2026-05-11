import releaseNotes from "@/data/release-notes.json";
import { fmtDate } from "@/lib/utils";
import { Info } from "lucide-react";
import type { ReleaseNote } from "@/types";
import WhatsNewMoreInfoButton from "@/components/ui/WhatsNewMoreInfoButton";

const notes: ReleaseNote[] = releaseNotes;
const lastUpdated = notes[0]?.date;

export default function Page() {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }}>
          Release Notes
        </h1>
        {lastUpdated && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Last updated {fmtDate(lastUpdated)}
          </span>
        )}
      </div>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Recent updates and changes.
      </p>
      <div className="space-y-3">
        {notes.map((note, i) => (
          <div
            key={i}
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Info size={14} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {fmtDate(note.date)}
                </span>
              </div>
              {note.whatsNew && <WhatsNewMoreInfoButton releaseNote={note} />}
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {note.title}
            </p>
            {note.details && note.details.length > 0 && (
              <ul className="mt-2 space-y-1">
                {note.details.map((d, j) => (
                  <li
                    key={j}
                    className="text-xs flex items-start gap-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span
                      className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                      style={{ background: "var(--text-muted)" }}
                    />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
