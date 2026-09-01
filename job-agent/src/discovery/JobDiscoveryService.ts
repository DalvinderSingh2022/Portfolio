import type { Job, MergedJob, RawJob } from "../domain/job.js";
import { RawJobSchema } from "../domain/job.js";
import { buildCriteria, type SearchConfig, type SearchOverrides } from "../domain/search.js";
import type { JobSource } from "../sources/JobSource.js";
import type { SourceRunError } from "../sources/JobSource.js";
import { log } from "../utils/logger.js";
import { withRetry } from "../utils/rateLimit.js";
import { JobDeduplicator } from "./JobDeduplicator.js";
import { JobEnricher } from "./JobEnricher.js";
import { JobNormalizer } from "./JobNormalizer.js";

export interface DiscoveryResult {
  jobs: MergedJob[];
  rawCount: number;
  normalizedCount: number;
  invalidCount: number;
  duplicatesRemoved: number;
  sourcesUsed: string[];
  errors: SourceRunError[];
}

/**
 * Stage 1–5 of the pipeline: fan out to sources (isolating failures), normalize,
 * validate, deduplicate and enrich. Produces a clean set of MergedJobs ready for
 * matching. Sources, normalizer, deduplicator and enricher are injected so each
 * is independently testable and swappable.
 */
export class JobDiscoveryService {
  private readonly logger = log("discovery");

  constructor(
    private readonly sources: JobSource[],
    private readonly normalizer: JobNormalizer = new JobNormalizer(),
    private readonly deduplicator: JobDeduplicator = new JobDeduplicator(),
    private readonly enricher: JobEnricher = new JobEnricher(),
  ) {}

  async discover(config: SearchConfig, overrides: SearchOverrides = {}): Promise<DiscoveryResult> {
    const enabled = this.sources.filter((s) => s.enabled);
    const errors: SourceRunError[] = [];
    const raw: RawJob[] = [];

    for (const source of enabled) {
      const criteria = buildCriteria(config, source.name, overrides);
      for (const c of criteria) {
        try {
          const results = await withRetry(() => source.searchJobs(c), {
            retries: 2,
            timeoutMs: 15_000,
            onRetry: (attempt, error, delay) =>
              this.logger.warn(
                { source: source.name, attempt, delay, err: (error as Error).message },
                "retrying source",
              ),
          });
          // Validate each raw job defensively; drop (and log) malformed ones.
          for (const item of results) {
            const parsed = RawJobSchema.safeParse(item);
            if (parsed.success) raw.push(parsed.data);
            else this.logger.debug({ source: source.name }, "dropping malformed raw job");
          }
          this.logger.info({ source: source.name, query: c.query, found: results.length }, "source searched");
        } catch (error) {
          // One source/criteria failure must never abort the run.
          const message = (error as Error).message;
          this.logger.warn({ source: source.name, query: c.query, err: message }, "source failed");
          errors.push({ source: source.name, message, criteria: c });
        }
      }
    }

    const now = new Date();
    const normalized: Job[] = [];
    let invalidCount = 0;
    for (const r of raw) {
      const result = this.normalizer.normalize(r, now);
      if (result.ok) normalized.push(result.job);
      else {
        invalidCount++;
        this.logger.debug({ source: r.source, reason: result.reason }, "invalid job dropped");
      }
    }

    const { merged, duplicatesRemoved } = this.deduplicator.deduplicate(normalized);
    const enriched = this.enricher.enrichAll(merged);

    this.logger.info(
      { raw: raw.length, normalized: normalized.length, invalid: invalidCount, duplicatesRemoved, unique: enriched.length },
      "discovery complete",
    );

    return {
      jobs: enriched,
      rawCount: raw.length,
      normalizedCount: normalized.length,
      invalidCount,
      duplicatesRemoved,
      sourcesUsed: enabled.map((s) => s.name),
      errors,
    };
  }
}
