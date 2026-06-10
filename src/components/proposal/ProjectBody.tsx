"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import type { ProposalCopy } from "@/lib/proposal-copy";
import { formatDateShort, formatEuro } from "@/lib/proposal-format";
import { FieldBlock, InlineLabel, MetaChip, SessionRow } from "./primitives";
import type { ProposalProject } from "./types";

/**
 * Tier 2 + tier 3 of the project disclosure model, shared by every display
 * variant so they stay consistent and DRY:
 *  - Tier 2 (overview, always shown here): the "why" lead, the outcomes
 *    (deliverables), sessions, and team — the scannable essence.
 *  - Tier 3 (on demand): the full approach (how / what / activities), revealed
 *    behind "Toon volledige aanpak" via the grid-rows collapse.
 */
export default function ProjectBody({
  project,
  brandColor,
  t,
  lang,
}: {
  project: ProposalProject;
  brandColor: string;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  const [showApproach, setShowApproach] = useState(false);
  const s = project.sections;
  const approachId = `approach-${project.id}`;
  const hasApproach = Boolean(s.how || s.what || s.activities);

  return (
    <div className="space-y-8">
      {/* Lead — the why */}
      {s.why && (
        <div className="prose-proposal text-text-primary">
          <RichTextDisplay html={s.why} />
        </div>
      )}

      {/* Outcomes */}
      {s.deliverables && <FieldBlock label={t.resultsLabel} content={s.deliverables} />}

      {/* Sessions */}
      {project.sessions.length > 0 && (
        <div>
          <InlineLabel>{t.sessionsLabel}</InlineLabel>
          <p className="-mt-1.5 mb-3 text-sm" style={{ color: "var(--proposal-muted)" }}>
            {t.sessionsIntro}
          </p>
          <div className="rounded-xl border border-border-default overflow-hidden">
            {project.sessions.map((sess, i) => (
              <SessionRow key={sess.id} session={sess} first={i === 0} t={t} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      {project.team.length > 0 && (
        <div>
          <InlineLabel>{t.teamLabel}</InlineLabel>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {project.team.map((m) => (
              <div key={m.userId} className="flex items-center gap-2.5">
                <UserAvatar name={m.name} image={m.image ?? null} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{m.name}</p>
                  {m.roleLabel && (
                    <p className="text-xs" style={{ color: "var(--proposal-muted)" }}>
                      {m.roleLabel}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier 3 — full approach */}
      {hasApproach && (
        <div>
          <button
            type="button"
            onClick={() => setShowApproach((v) => !v)}
            aria-expanded={showApproach}
            aria-controls={approachId}
            className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:[outline:2px_solid_var(--text-primary)] focus-visible:outline-offset-2"
            style={{ color: brandColor }}
          >
            {showApproach ? t.hideApproach : t.fullApproach}
            <ChevronDown
              size={16}
              className="transition-transform duration-300"
              style={{ transform: showApproach ? "rotate(180deg)" : "none" }}
            />
          </button>
          <div id={approachId} className={`proposal-collapse ${showApproach ? "is-open" : ""}`}>
            <div className="proposal-collapse-inner">
              <div className="space-y-8 pt-8">
                {s.how && <FieldBlock label={t.howLabel} content={s.how} />}
                {s.what && <FieldBlock label={t.whatLabel} content={s.what} />}
                {s.activities && <FieldBlock label={t.activitiesLabel} content={s.activities} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full project detail = number + service + title + meta chips, then ProjectBody.
 * Re-mounts on selection change (key) so the reveal re-fires. Shared by the
 * index + detail and timeline-driven variants.
 */
export function ProjectDetailPanel({
  project,
  index,
  brandColor,
  t,
  lang,
  showIndex = true,
}: {
  project: ProposalProject;
  index: number;
  brandColor: string;
  t: ProposalCopy;
  lang: "nl" | "en";
  /** Hide the leading "01" marker when numbering carries no meaning (e.g. a lone project). */
  showIndex?: boolean;
}) {
  return (
    <div>
      {(showIndex || project.service) && (
        <div className="flex items-baseline gap-3 mb-3">
          {showIndex && (
            <span className="text-sm tabular-nums font-semibold" style={{ color: brandColor }}>
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          {project.service && <span className="typo-proposal-inline-label !mb-0">{project.service}</span>}
        </div>
      )}
      <h3 className="typo-proposal-h3 mb-5">{project.title}</h3>

      <div className="mb-8 flex flex-wrap gap-2">
        {project.scheduledStartDate && project.scheduledEndDate && (
          <MetaChip
            label={t.whenLabel}
            value={`${formatDateShort(project.scheduledStartDate, lang)} – ${formatDateShort(project.scheduledEndDate, lang)}`}
          />
        )}
        {project.durationDays != null && (
          <MetaChip
            label={t.durationLabel}
            value={`${project.durationDays} ${project.durationDays === 1 ? t.dayLabel : t.daysLabel}`}
          />
        )}
        {project.soldPrice > 0 && (
          <MetaChip
            label={t.investmentLabel}
            value={
              project.discountAmount > 0 ? (
                <>
                  <span className="line-through mr-1.5" style={{ color: "var(--proposal-muted)" }}>
                    <span className="sr-only">{t.originalPrice}: </span>
                    {formatEuro(project.soldPrice)}
                  </span>
                  {formatEuro(project.netPrice)}
                </>
              ) : (
                formatEuro(project.soldPrice)
              )
            }
          />
        )}
      </div>

      <ProjectBody project={project} brandColor={brandColor} t={t} lang={lang} />
    </div>
  );
}
