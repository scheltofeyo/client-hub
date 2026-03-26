/**
 * Converts any Google Sheets share URL into an embeddable /pub URL.
 * The sheet must be shared as "Anyone with the link can view".
 */
export function toEmbedUrl(rawUrl: string): string {
  const match = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return rawUrl;
  const sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&embedded=true`;
}
