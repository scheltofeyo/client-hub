/**
 * Split an authored body field into paragraphs on blank lines. Single newlines
 * are left inside a paragraph, so a soft wrap someone typed does not become a
 * paragraph break on the participant page.
 *
 * Shared by every screen whose copy is one authored textarea rather than a field
 * per paragraph — the welcome screen and the closing screen — so authors are not
 * made to count paragraph slots.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}
