/**
 * Minimal, dependency-free HTML handling for ATS payloads. Greenhouse returns
 * HTML that is *entity-encoded* (e.g. `&lt;p&gt;`), and Lever's `lists` contain
 * raw HTML `<li>` items. We only need readable plain text + bullet extraction,
 * so a full HTML parser would be overkill.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
};

/** Decode HTML entities (named + numeric, decimal and hex). */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function safeFromCodePoint(code: number): string {
  try {
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  } catch {
    return "";
  }
}

/**
 * Convert (possibly entity-encoded) HTML to readable plain text: decode
 * entities, turn block/break tags into newlines, strip remaining tags, and
 * collapse excess whitespace.
 */
export function htmlToText(input: string | undefined): string {
  if (!input) return "";
  // Greenhouse double-encodes: decode once so tags become real, then process.
  let text = decodeEntities(input);
  text = text
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");
  text = decodeEntities(text); // catch entities that were themselves encoded
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/** Extract `<li>` items from an HTML fragment as a clean string array. */
export function extractListItems(html: string | undefined): string[] {
  if (!html) return [];
  const decoded = decodeEntities(html);
  const items = [...decoded.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
    htmlToText(m[1] ?? "").replace(/^•\s*/, "").trim(),
  );
  return items.filter(Boolean);
}
