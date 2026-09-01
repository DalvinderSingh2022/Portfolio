import type { CandidateProfile } from "../domain/candidate.js";
import type { MergedJob } from "../domain/job.js";
import { LLMMatchResultSchema, type LLMMatchResult } from "../domain/matching.js";
import { log } from "../utils/logger.js";
import { sha1 } from "../utils/text.js";
import { withRetry } from "../utils/rateLimit.js";
import type { LLMClient } from "./llm/LLMClient.js";
import { buildJobMatchPrompt } from "./prompts/job-match.prompt.js";

/**
 * Caches LLM verdicts keyed by (job fingerprint + candidate profile version).
 * If the same job is re-evaluated against the same profile version, we skip the
 * (paid) LLM call entirely.
 */
export interface MatchCache {
  get(key: string): Promise<LLMMatchResult | null>;
  set(key: string, value: LLMMatchResult): Promise<void>;
}

export class InMemoryMatchCache implements MatchCache {
  private readonly store = new Map<string, LLMMatchResult>();
  async get(key: string): Promise<LLMMatchResult | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: LLMMatchResult): Promise<void> {
    this.store.set(key, value);
  }
}

export interface LLMMatcherOptions {
  enabled: boolean;
  cache?: MatchCache;
}

/**
 * Stage 2 matching. Runs ONLY on jobs that survived rule-based filtering, and
 * only when explicitly enabled. Never trusts raw model output: JSON parse → Zod
 * validation → business checks before the result is used.
 */
export class LLMMatcher {
  private readonly logger = log("llm-matcher");
  private readonly cache: MatchCache;
  private readonly enabled: boolean;

  constructor(
    private readonly client: LLMClient,
    options: LLMMatcherOptions,
  ) {
    this.enabled = options.enabled;
    this.cache = options.cache ?? new InMemoryMatchCache();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  cacheKey(job: MergedJob, profileVersion: number): string {
    return sha1(`${job.fingerprint}|v${profileVersion}`);
  }

  async match(job: MergedJob, profile: CandidateProfile, resume: string): Promise<LLMMatchResult | null> {
    if (!this.enabled) return null;

    const key = this.cacheKey(job, profile.version);
    const cached = await this.cache.get(key);
    if (cached) {
      this.logger.debug({ jobId: job.id }, "llm cache hit");
      return cached;
    }

    const prompt = buildJobMatchPrompt(profile, resume, job);
    try {
      const raw = await withRetry(() => this.client.complete(prompt), { retries: 1, timeoutMs: 30_000 });
      const result = this.parseAndValidate(raw);
      if (!result) {
        this.logger.warn({ jobId: job.id }, "llm output failed validation; falling back to rule-based");
        return null;
      }
      await this.cache.set(key, result);
      return result;
    } catch (error) {
      this.logger.warn({ jobId: job.id, err: (error as Error).message }, "llm call failed; falling back");
      return null;
    }
  }

  private parseAndValidate(raw: string): LLMMatchResult | null {
    const json = this.extractJson(raw);
    if (!json) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }
    const validated = LLMMatchResultSchema.safeParse(parsed);
    if (!validated.success) return null;

    // Business validation: recommendation must not contradict the overall score.
    const r = validated.data;
    if (r.recommendation === "reject" && r.overallScore >= 65) return null;
    if (r.recommendation === "highly_relevant" && r.overallScore < 70) return null;
    return r;
  }

  /** Tolerate models that wrap JSON in prose/markdown fences. */
  private extractJson(raw: string): string | null {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return raw.slice(start, end + 1);
    return null;
  }
}
