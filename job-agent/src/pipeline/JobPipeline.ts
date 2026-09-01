import { loadCandidate } from "../candidate/profile.js";
import { getEnv, type Env } from "../config/env.js";
import type { LoadedCandidate } from "../domain/candidate.js";
import type { MatchedJob } from "../domain/matching.js";
import type { SearchConfig, SearchOverrides } from "../domain/search.js";
import { JobDiscoveryService, type DiscoveryResult } from "../discovery/JobDiscoveryService.js";
import { JobMatchingService, type MatchingResult } from "../matching/JobMatchingService.js";
import { LLMMatcher } from "../matching/LLMMatcher.js";
import { createLLMClient } from "../matching/llm/LLMClient.js";
import { RuleBasedMatcher } from "../matching/RuleBasedMatcher.js";
import { ScoringService } from "../matching/ScoringService.js";
import { ConsoleNotifier } from "../notifications/ConsoleNotifier.js";
import { EmailNotifier } from "../notifications/EmailNotifier.js";
import { NotificationService } from "../notifications/NotificationService.js";
import { activeSources } from "../sources/registry.js";
import type { Storage } from "../storage/repositories/types.js";
import { log } from "../utils/logger.js";

export interface PipelineSummary {
  runId: string;
  sources: string[];
  found: number;
  duplicates: number;
  newJobs: number;
  filtered: number;
  shortlisted: number;
  highMatches: number;
  notificationsSent: number;
  topMatches: MatchedJob[];
  errors: { source: string; message: string }[];
  durationMs: number;
}

/**
 * The composition of every stage into one runnable job. Dependencies are
 * injected so the pipeline is testable with fakes; `buildPipeline` wires the
 * production defaults.
 */
export class JobPipeline {
  private readonly logger = log("pipeline");

  constructor(
    private readonly discovery: JobDiscoveryService,
    private readonly matching: JobMatchingService,
    private readonly notifications: NotificationService,
    private readonly storage: Storage,
    private readonly candidate: LoadedCandidate,
  ) {}

  async run(config: SearchConfig, overrides: SearchOverrides = {}): Promise<PipelineSummary> {
    const startedAt = new Date();
    this.logger.info({ backend: this.storage.backend }, "starting job discovery");

    const run = await this.storage.searchRuns.create({
      startedAt,
      sources: activeSources().map((s) => s.name),
      queries: overrides.query ? [overrides.query] : config.queries,
      jobsFound: 0,
      jobsNew: 0,
      jobsDuplicate: 0,
      jobsRejected: 0,
      jobsShortlisted: 0,
      errors: [],
    });

    // Stages 1–5: discover, normalize, validate, dedupe, enrich.
    const discovery: DiscoveryResult = await this.discovery.discover(config, overrides);

    // Persist discovered jobs (idempotent upsert merges cross-run duplicates).
    let newJobs = 0;
    const seenAt = new Date();
    for (const job of discovery.jobs) {
      const { isNew } = await this.storage.jobs.upsertDiscovered(job, seenAt);
      if (isNew) newJobs++;
    }

    // Stages 6–9: rule filter, (capped) LLM match, score, rank.
    const matching: MatchingResult = await this.matching.matchAll(discovery.jobs, this.candidate);

    // Persist all match results (ranked + rejected).
    for (const m of [...matching.ranked, ...matching.rejected]) {
      await this.storage.jobs.saveMatch(m.job.id, m.match);
    }

    const threshold = this.candidate.profile.minimumMatchScore;
    const shortlisted = matching.ranked.filter((m) => m.match.finalScore >= threshold);
    const highMatches = matching.ranked.filter((m) => m.match.recommendation === "highly_relevant");

    // Stage 10: notify high matches.
    const notificationsSent = await this.notifications.notifyAll(shortlisted);

    const errors = discovery.errors.map((e) => ({ source: e.source, message: e.message }));
    await this.storage.searchRuns.complete(run.id, {
      completedAt: new Date(),
      jobsFound: discovery.rawCount,
      jobsNew: newJobs,
      jobsDuplicate: discovery.duplicatesRemoved,
      jobsRejected: matching.ruleFiltered,
      jobsShortlisted: shortlisted.length,
      errors,
    });

    const durationMs = Date.now() - startedAt.getTime();
    this.logger.info({ durationMs, found: discovery.rawCount, newJobs }, "search completed");

    return {
      runId: run.id,
      sources: discovery.sourcesUsed,
      found: discovery.rawCount,
      duplicates: discovery.duplicatesRemoved,
      newJobs,
      filtered: matching.ruleFiltered,
      shortlisted: shortlisted.length,
      highMatches: highMatches.length,
      notificationsSent,
      topMatches: matching.ranked.slice(0, 10),
      errors,
      durationMs,
    };
  }
}

/** Production composition root. */
export async function buildPipeline(storage: Storage, env: Env = getEnv()): Promise<JobPipeline> {
  const candidate = await loadCandidate();

  const discovery = new JobDiscoveryService(activeSources(env));

  const ruleMatcher = new RuleBasedMatcher();
  const scoring = new ScoringService();
  const llmMatcher = new LLMMatcher(createLLMClient(env), { enabled: env.ENABLE_LLM_MATCHING });
  const matching = new JobMatchingService(ruleMatcher, scoring, llmMatcher, { llmMaxJobs: env.LLM_MAX_JOBS });

  const notifiers = [new ConsoleNotifier(), new EmailNotifier(env)];
  const notifications = new NotificationService(notifiers, storage, env.MIN_MATCH_SCORE);

  return new JobPipeline(discovery, matching, notifications, storage, candidate);
}
