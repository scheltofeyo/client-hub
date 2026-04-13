import releaseNotes from "@/data/release-notes.json";
import { fmtDate } from "@/lib/utils";
import { Info } from "lucide-react";
import type { ReleaseNote } from "@/types";

const notes: ReleaseNote[] = releaseNotes;

export default function Page() {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <h1 className="typo-page-title mb-1" style={{ color: "var(--text-primary)" }}>
        Release Notes
      </h1>
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
            <div className="flex items-center gap-2 mb-1.5">
              <Info size={14} style={{ color: "var(--primary)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {fmtDate(note.date)}
              </span>
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
