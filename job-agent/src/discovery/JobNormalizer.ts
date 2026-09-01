import { JobSchema, type Job, type RawJob, type RemoteType } from "../domain/job.js";
import { canonicalizeUrl, normalizeLocation, normalizeTitle, sha1 } from "../utils/text.js";

export type NormalizeResult =
  | { ok: true; job: Job }
  | { ok: false; reason: string; raw: RawJob };

/**
 * Turns a messy RawJob into a strict, validated Job: fills defaults, infers
 * remote type, and computes the deterministic fingerprint + id that drive
 * deduplication and idempotent storage.
 */
export class JobNormalizer {
  normalize(raw: RawJob, discoveredAt: Date = new Date()): NormalizeResult {
    const title = (raw.title ?? "").trim();
    const company = (raw.company ?? "").trim() || "Unknown";
    const applicationUrl = (raw.applicationUrl ?? raw.sourceUrl ?? "").trim();
    const sourceUrl = (raw.sourceUrl ?? raw.applicationUrl ?? "").trim();

    if (!title) return { ok: false, reason: "missing title", raw };
    if (!applicationUrl && !sourceUrl) return { ok: false, reason: "missing url", raw };

    const postedAt = this.parseDate(raw.postedAt);
    const remoteType = this.inferRemoteType(raw);
    const fingerprint = this.fingerprint(company, title, raw.location);

    const candidate: Job = {
      id: this.buildId(raw, fingerprint),
      source: raw.source,
      externalId: raw.externalId,
      title,
      company,
      location: raw.location?.trim() || undefined,
      remoteType,
      employmentType: raw.employmentType?.trim() || undefined,
      experienceRequired: raw.experienceRequired?.trim() || undefined,
      salary: raw.salary,
      description: (raw.description ?? "").trim(),
      requirements: this.cleanList(raw.requirements),
      responsibilities: this.cleanList(raw.responsibilities),
      skills: this.cleanList(raw.skills),
      postedAt,
      applicationUrl: applicationUrl || sourceUrl,
      sourceUrl: sourceUrl || applicationUrl,
      discoveredAt,
      fingerprint,
    };

    const parsed = JobSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, reason: parsed.error.issues.map((i) => i.message).join("; "), raw };
    }
    return { ok: true, job: parsed.data };
  }

  /** company + normalized_title + normalized_location → stable hash. */
  fingerprint(company: string, title: string, location: string | undefined): string {
    const key = [normalizeTitle(company), normalizeTitle(title), normalizeLocation(location)].join("|");
    return sha1(key);
  }

  private buildId(raw: RawJob, fingerprint: string): string {
    if (raw.externalId) return `${raw.source}:${raw.externalId}`;
    const url = canonicalizeUrl(raw.sourceUrl ?? raw.applicationUrl);
    return `${raw.source}:${url ? sha1(url) : fingerprint}`;
  }

  private inferRemoteType(raw: RawJob): RemoteType {
    if (raw.remoteType) return raw.remoteType;
    const text = `${raw.title ?? ""} ${raw.location ?? ""} ${raw.description ?? ""}`.toLowerCase();
    if (/\bremote\b/.test(text)) return "remote";
    if (/\bhybrid\b/.test(text)) return "hybrid";
    if (/\b(on-?site|in office|in-office)\b/.test(text)) return "onsite";
    return "unknown";
  }

  private cleanList(list: string[] | undefined): string[] {
    if (!list) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
      const trimmed = item.trim();
      const key = trimmed.toLowerCase();
      if (trimmed && !seen.has(key)) {
        seen.add(key);
        out.push(trimmed);
      }
    }
    return out;
  }

  private parseDate(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
}
