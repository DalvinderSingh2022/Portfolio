import { derivePreferences } from "../candidate/preferences.js";
import type { LoadedCandidate } from "../domain/candidate.js";
import type { MergedJob } from "../domain/job.js";
import type { MatchedJob, RuleMatchResult } from "../domain/matching.js";
import { log } from "../utils/logger.js";
import type { LLMMatcher } from "./LLMMatcher.js";
import { RuleBasedMatcher } from "./RuleBasedMatcher.js";
import { ScoringService } from "./ScoringService.js";

export interface MatchingResult {
  ranked: MatchedJob[];
  rejected: MatchedJob[];
  ruleFiltered: number;
  llmEvaluated: number;
}

export interface MatchingOptions {
  /** Max jobs to forward to the LLM stage (cost cap). */
  llmMaxJobs: number;
}

/**
 * Stages 6–9: rule-based filtering → (capped) AI matching → scoring → ranking.
 * Cost control is explicit: the LLM only ever sees the top-N survivors of the
 * cheap rule pass, ordered by their rule-only score.
 */
export class JobMatchingService {
  private readonly logger = log("matching");

  constructor(
    private readonly ruleMatcher: RuleBasedMatcher,
    private readonly scoring: ScoringService,
    private readonly llmMatcher: LLMMatcher,
    private readonly options: MatchingOptions,
  ) {}

  async matchAll(jobs: MergedJob[], candidate: LoadedCandidate): Promise<MatchingResult> {
    const prefs = derivePreferences(candidate.profile);

    // --- Rule pass --------------------------------------------------------
    const evaluated = jobs.map((job) => ({ job, rule: this.ruleMatcher.match(job, prefs) }));
    const survivors = evaluated.filter((e) => !e.rule.rejected);
    const rejectedRaw = evaluated.filter((e) => e.rule.rejected);

    // Rank survivors by a cheap rule-only score to choose LLM candidates.
    const ruleScored = survivors
      .map((e) => ({ ...e, prelim: this.scoring.score(e.job.id, e.rule).finalScore }))
      .sort((a, b) => b.prelim - a.prelim);

    // --- LLM pass (capped) ------------------------------------------------
    const llmBudget = this.llmMatcher.isEnabled ? this.options.llmMaxJobs : 0;
    let llmEvaluated = 0;
    const ranked: MatchedJob[] = [];
    for (let i = 0; i < ruleScored.length; i++) {
      const entry = ruleScored[i]!;
      const useLLM = i < llmBudget;
      const llm = useLLM
        ? await this.llmMatcher.match(entry.job, candidate.profile, candidate.resume)
        : null;
      if (llm) llmEvaluated++;
      const match = this.scoring.score(entry.job.id, entry.rule, llm ?? undefined);
      ranked.push({ job: entry.job, match });
    }
    ranked.sort((a, b) => b.match.finalScore - a.match.finalScore);

    const rejected = rejectedRaw.map(({ job, rule }) => ({
      job,
      match: this.scoring.score(job.id, rule),
    }));

    this.logger.info(
      { total: jobs.length, ruleFiltered: rejected.length, survivors: ranked.length, llmEvaluated },
      "matching complete",
    );

    return { ranked, rejected, ruleFiltered: rejectedRaw.length, llmEvaluated };
  }

  /** Convenience for single-job scoring (used by tests). */
  matchOne(job: MergedJob, candidate: LoadedCandidate): { rule: RuleMatchResult; matched: MatchedJob } {
    const prefs = derivePreferences(candidate.profile);
    const rule = this.ruleMatcher.match(job, prefs);
    const match = this.scoring.score(job.id, rule);
    return { rule, matched: { job, match } };
  }
}
