"use client";

import { Eye, EyeOff } from "lucide-react";
import RichTextEditor from "@/components/ui/RichTextEditor";

export interface RichSection {
  key: string;
  label: string;
  value: string | null;
  /** Project surface only: section hidden from the public overview. */
  hidden?: boolean;
}

/**
 * The why / what / how / activities / deliverables rich-text block, shared by the
 * plan draft-project editor (with per-section visibility toggle) and the admin
 * template editor (no visibility toggle). Pass `onToggleHidden` to enable the
 * Eye/EyeOff control.
 */
export default function RichSectionGroup({
  sections,
  editorKey,
  readonly,
  onChange,
  onToggleHidden,
}: {
  sections: RichSection[];
  editorKey: number;
  readonly: boolean;
  onChange: (key: string, html: string) => void;
  onToggleHidden?: (key: string) => void;
}) {
  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const hidden = !!section.hidden;
        return (
          <div key={section.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="typo-label capitalize mb-0">{section.label}</label>
              {onToggleHidden && !readonly && (
                <button
                  type="button"
                  onClick={() => onToggleHidden(section.key)}
                  className="flex items-center gap-1 text-xs btn-tertiary"
                  aria-pressed={hidden}
                  title={hidden ? "Show this section in the client overview" : "Hide this section from the client overview"}
                >
                  {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  {hidden ? "Hidden" : "Visible"}
                </button>
              )}
            </div>
            {hidden ? (
              <div
                className="rounded-button border px-3 py-2 text-xs italic"
                style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}
              >
                Hidden from the client overview — content is preserved. Click &ldquo;Hidden&rdquo; above to show it again.
              </div>
            ) : (
              <RichTextEditor
                key={`${section.key}-${editorKey}`}
                content={section.value ?? ""}
                onChange={(html) => onChange(section.key, html)}
                placeholder={`Describe the ${section.label.toLowerCase()}…`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
