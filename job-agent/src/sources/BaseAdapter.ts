import type { JobSourceName, RawJob } from "../domain/job.js";
import type { JobSearchCriteria } from "../domain/search.js";
import { log } from "../utils/logger.js";
import { RateLimiter } from "../utils/rateLimit.js";
import { SourceNotImplementedError, type JobSource } from "./JobSource.js";

/**
 * Shared scaffolding for real-platform adapters. Each concrete adapter documents
 * the *permitted* integration path for its platform (official API, feed, or
 * user-provided export) and, until that path is wired, returns nothing rather
 * than scraping. Adapters are disabled by default via env flags.
 *
 * IMPORTANT: We do not bypass authentication, rate limits, or terms of service.
 * When a platform offers no permitted automated access, the correct behavior is
 * to stay disabled and let the operator supply data through an export/feed.
 */
export abstract class BaseAdapter implements JobSource {
  abstract readonly name: JobSourceName;
  /** One-line description of the sanctioned integration path. */
  protected abstract readonly integrationNote: string;

  protected readonly rateLimiter: RateLimiter;

  constructor(
    public readonly enabled: boolean,
    minIntervalMs = 2000,
  ) {
    this.rateLimiter = new RateLimiter(minIntervalMs);
  }

  async searchJobs(criteria: JobSearchCriteria): Promise<RawJob[]> {
    if (!this.enabled) return [];
    await this.rateLimiter.wait();
    log(this.name).info({ query: criteria.query, location: criteria.location }, "searching source");
    return this.doSearch(criteria);
  }

  /**
   * Concrete adapters override this once a permitted integration exists. The
   * default throws, so an operator who enables a source before wiring it gets a
   * clear, isolated failure instead of a silent empty result.
   */
  protected doSearch(_criteria: JobSearchCriteria): Promise<RawJob[]> {
    throw new SourceNotImplementedError(
      this.name,
      `No permitted integration wired yet. ${this.integrationNote} ` +
        `Keep ENABLE_${this.name.toUpperCase().replace(/-/g, "_")}=false until then.`,
    );
  }
}
