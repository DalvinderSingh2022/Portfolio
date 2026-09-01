import { createHash } from "node:crypto";

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a job title for matching/deduplication: drop seniority qualifiers,
 * gender tags, and common noise words so "Sr. React Developer (m/f)" and
 * "React Developer" compare equal on the core role.
 */
const TITLE_NOISE = new Set([
  "sr", "senior", "jr", "junior", "lead", "staff", "principal",
  "i", "ii", "iii", "iv", "1", "2", "3",
  "the", "a", "an", "for", "of", "and",
  "mf", "fmd", "mfd", "mfx", "remote", "hybrid", "onsite",
]);

export function normalizeTitle(title: string): string {
  const words = normalizeText(title).split(" ").filter((w) => w && !TITLE_NOISE.has(w));
  return words.join(" ");
}

/** Normalize a location string to a comparable key (city/country tokens). */
export function normalizeLocation(location: string | undefined): string {
  if (!location) return "";
  return normalizeText(location)
    .replace(/\b(area|region|metropolitan|greater|ncr)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a URL for comparison: strip protocol, query, fragment, trailing slash, www. */
export function canonicalizeUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

export function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

/** Tokenize into a set of lowercased word tokens (length >= 2). */
export function tokenSet(input: string): Set<string> {
  return new Set(normalizeText(input).split(" ").filter((w) => w.length >= 2));
}
