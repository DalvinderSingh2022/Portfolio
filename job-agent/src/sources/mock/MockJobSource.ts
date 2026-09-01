import type { JobSourceName, RawJob } from "../../domain/job.js";
import type { JobSearchCriteria } from "../../domain/search.js";
import { normalizeText } from "../../utils/text.js";
import type { JobSource } from "../JobSource.js";
import { MOCK_CATALOG, type CatalogEntry } from "./catalog.js";

/**
 * A fully working, deterministic source used for local development and tests.
 * It returns a curated catalog filtered by the search query/location so the
 * whole pipeline (normalize → dedup → match → score → rank) can run with zero
 * network access and no credentials.
 */
export class MockJobSource implements JobSource {
  readonly name: JobSourceName = "mock";
  readonly enabled = true;

  constructor(private readonly catalog: CatalogEntry[] = MOCK_CATALOG) {}

  async searchJobs(criteria: JobSearchCriteria): Promise<RawJob[]> {
    const queryTokens = normalizeText(criteria.query).split(" ").filter(Boolean);
    const locationNeedle = criteria.location ? normalizeText(criteria.location) : "";

    const scored = this.catalog
      .map((entry) => ({ entry, score: this.relevance(entry, queryTokens, locationNeedle) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const limit = criteria.limit ?? scored.length;
    return scored.slice(0, limit).map(({ entry }) => this.toRawJob(entry));
  }

  async getJobDetails(jobUrl: string): Promise<RawJob | null> {
    const entry = this.catalog.find((e) => e.sourceUrl === jobUrl || e.applicationUrl === jobUrl);
    return entry ? this.toRawJob(entry) : null;
  }

  /**
   * A coarse relevance score. Matches on title/skills against query tokens and
   * boosts on location. Spam/thin/irrelevant entries are still surfaced (with a
   * low base score) so the downstream quality filters can be exercised.
   */
  private relevance(entry: CatalogEntry, queryTokens: string[], locationNeedle: string): number {
    const haystack = normalizeText(
      [entry.title, entry.company, (entry.skills ?? []).join(" "), entry.description ?? ""].join(" "),
    );
    let score = 0.1; // base: mock always returns *something* so filters get tested
    for (const token of queryTokens) {
      if (normalizeText(entry.title ?? "").includes(token)) score += 3;
      else if (haystack.includes(token)) score += 1;
    }
    if (locationNeedle) {
      const loc = normalizeText(entry.location ?? "");
      if (loc.includes(locationNeedle) || (entry.remoteType === "remote" && locationNeedle.includes("remote"))) {
        score += 1;
      }
    }
    return score;
  }

  private toRawJob(entry: CatalogEntry): RawJob {
    const { postedHoursAgo, tags: _tags, ...rest } = entry;
    const postedAt =
      postedHoursAgo === undefined ? undefined : new Date(Date.now() - postedHoursAgo * 3600_000);
    return { ...rest, source: this.name, postedAt };
  }
}
