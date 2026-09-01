import type { JobSourceName, RawJob } from "../domain/job.js";
import type { JobSearchCriteria } from "../domain/search.js";

/**
 * The single seam every platform plugs into. Adding a source means implementing
 * this interface and registering the adapter — the discovery/matching/scoring/
 * storage layers never learn a new source exists.
 */
export interface JobSource {
  readonly name: JobSourceName;

  /** True when the adapter is wired up and permitted to run. */
  readonly enabled: boolean;

  /** Run one search and return raw (un-normalized) jobs. Must not throw for
   *  "no results"; throw only on real failures so the pipeline can isolate them. */
  searchJobs(criteria: JobSearchCriteria): Promise<RawJob[]>;

  /** Optionally fetch richer detail for a single job URL. */
  getJobDetails?(jobUrl: string): Promise<RawJob | null>;
}

/**
 * Thrown by adapters that intentionally do not perform automated access
 * (e.g. because a platform's ToS forbids scraping and no official API/feed is
 * wired yet). The pipeline treats this as a clean, expected source failure.
 */
export class SourceNotImplementedError extends Error {
  constructor(source: JobSourceName, detail: string) {
    super(`[${source}] ${detail}`);
    this.name = "SourceNotImplementedError";
  }
}

export interface SourceRunError {
  source: JobSourceName;
  message: string;
  criteria?: JobSearchCriteria;
}
