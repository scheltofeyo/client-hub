/**
 * Parse TSV content (from Google Sheets clipboard) into structured cultural DNA values.
 * Handles quoted fields with embedded newlines and escaped quotes.
 */

import type { CulturalDnaValue, CulturalBehavior } from "@/types";

// ── TSV parser ──────────────────────────────────────────────────────────

/** Parse raw TSV text into a 2D string array, handling quoted multi-line fields. */
export function parseTsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") or end of quoted field
        if (i + 1 < raw.length && raw[i + 1] === '"') {
          field += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "\t") {
      current.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      current.push(field);
      field = "";
      if (ch === "\r" && i + 1 < raw.length && raw[i + 1] === "\n") i++;
      if (current.some((c) => c.trim())) rows.push(current);
      current = [];
    } else {
      field += ch;
    }
  }

  // Flush last row
  current.push(field);
  if (current.some((c) => c.trim())) rows.push(current);

  return rows;
}

// ── Bullet-to-HTML conversion ───────────────────────────────────────────

/** Convert plain-text bullet points ("- item\n- item") to an HTML <ul>. */
export function bulletsToHtml(text: string): string {
  if (!text.trim()) return "";

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets = lines.map((l) => l.replace(/^[-•]\s*/, ""));
  if (bullets.length === 0) return "";

  return `<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

// ── Header detection ────────────────────────────────────────────────────

/** True when a cell looks like behavior content (long, multi-line, starts with bullet). */
function isBehaviorLike(s: string): boolean {
  return s.includes("\n") || s.startsWith("- ") || s.startsWith("• ") || s.length > 120;
}

// ── Color palette ───────────────────────────────────────────────────────

const IMPORT_COLORS = [
  "#7C5CFC", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#8B5CF6", "#6366F1", "#14B8A6",
];

// ── Main parse function ─────────────────────────────────────────────────

export interface ParseResult {
  values: CulturalDnaValue[];
  levels: string[];
  hasHeader: boolean;
}

/**
 * Parse TSV into CulturalDnaValue[].
 *
 * Expected column order:
 *   Title | Mantra | Description | [Level1 behaviors] | [Level2 behaviors] | ...
 *
 * If the first row looks like a header (no bullet-point content in level columns),
 * level names are taken from columns 3+. Otherwise levels default to "Level 1", etc.
 *
 * Colors are auto-assigned from the accent palette.
 */
export function parseCulturalDnaTsv(raw: string): ParseResult {
  const rows = parseTsvRows(raw);
  if (rows.length === 0) return { values: [], levels: [], hasHeader: false };

  const firstRow = rows[0];

  // Header detection: columns 3+ should NOT look like behavior content
  const hasHeader =
    firstRow.length >= 4 && !firstRow.slice(3).some(isBehaviorLike);

  let levelNames: string[];
  let dataRows: string[][];

  if (hasHeader) {
    levelNames = firstRow.slice(3).map((h) => h.trim()).filter(Boolean);
    dataRows = rows.slice(1);
  } else {
    const numLevels = Math.max(0, (rows[0]?.length ?? 3) - 3);
    levelNames = Array.from({ length: numLevels }, (_, i) => `Level ${i + 1}`);
    dataRows = rows;
  }

  const values: CulturalDnaValue[] = dataRows
    .filter((row) => (row[0] ?? "").trim())
    .map((row, idx) => {
      const title = (row[0] ?? "").trim();
      const mantra = (row[1] ?? "").trim();
      const description = (row[2] ?? "").trim();

      const behaviors: CulturalBehavior[] = levelNames.map((level, i) => ({
        level,
        content: bulletsToHtml((row[3 + i] ?? "").trim()),
      }));

      return {
        id: crypto.randomUUID(),
        title,
        color: IMPORT_COLORS[idx % IMPORT_COLORS.length],
        mantra,
        description,
        behaviors: behaviors.filter((b) => b.content),
      };
    });

  return { values, levels: levelNames, hasHeader };
}
