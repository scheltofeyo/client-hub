"use client";

import RichTextDisplay from "@/components/ui/RichTextDisplay";
import type { ProposalCopy } from "@/lib/proposal-copy";
import { localeFor } from "@/lib/proposal-format";
import type { ProposalSession } from "./types";

export function InlineLabel({ children, brand }: { children: React.ReactNode; brand?: string }) {
  return (
    <p className="typo-proposal-inline-label mb-3" style={brand ? { color: brand } : undefined}>
      {children}
    </p>
  );
}

export function FieldBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <InlineLabel>{label}</InlineLabel>
      <div className="prose-proposal text-text-primary">
        <RichTextDisplay html={content} />
      </div>
    </div>
  );
}

/** A small meta chip (e.g. "6 dagen", "€ 12.000", "28 mei – 7 jun"). */
export function MetaChip({ label, value }: { label?: string; value: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded-full border border-border-default bg-surface px-3 py-1 text-sm"
      style={{ color: "var(--text-primary)" }}
    >
      {label && <span className="typo-proposal-inline-label !mb-0">{label}</span>}
      <span className="tabular-nums font-medium">{value}</span>
    </span>
  );
}

export function SessionRow({
  session,
  first,
  t,
  lang,
}: {
  session: ProposalSession;
  first: boolean;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  const d = session.date ? new Date(session.date + "T00:00:00") : null;
  const validDate = d && !isNaN(d.getTime()) ? d : null;
  const day = validDate ? validDate.getDate() : null;
  const month = validDate
    ? validDate.toLocaleDateString(localeFor(lang), { month: "short" }).toUpperCase()
    : null;

  const metaParts: string[] = [];
  if (session.location) metaParts.push(session.location);
  if (session.participantCount > 0) {
    metaParts.push(
      `${session.participantCount} ${session.participantCount === 1 ? t.participantSingular : t.participantPlural}`
    );
  }

  return (
    <div className={`flex items-baseline gap-3.5 px-4 py-2.5${first ? "" : " border-t border-border-default"}`}>
      {/* Compact date — a single quiet line ("12 JUN") rather than a boxed tile. */}
      <div className="shrink-0 w-14">
        {validDate ? (
          <p className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-sm font-semibold leading-none text-text-primary">{day}</span>
            <span className="typo-proposal-inline-label !mb-0" style={{ letterSpacing: "0.12em" }}>
              {month}
            </span>
          </p>
        ) : (
          <span className="typo-proposal-inline-label !mb-0">{t.tbdLabel}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary leading-snug">{session.title}</p>
        {metaParts.length > 0 && (
          <p className="text-xs mt-0.5" style={{ color: "var(--proposal-muted)" }}>
            {metaParts.join(" · ")}
          </p>
        )}
        {session.info && (
          <div className="mt-1.5 prose-proposal text-[13px] text-text-primary">
            <RichTextDisplay html={session.info} />
          </div>
        )}
      </div>
    </div>
  );
}
