import { loadCandidate } from "../candidate/profile.js";
import { getEnv } from "../config/env.js";
import { loadSearchConfig } from "../config/searchConfig.js";
import { JobDiscoveryService } from "../discovery/JobDiscoveryService.js";
import type { SearchOverrides } from "../domain/search.js";
import { JobMatchingService } from "../matching/JobMatchingService.js";
import { LLMMatcher } from "../matching/LLMMatcher.js";
import { createLLMClient } from "../matching/llm/LLMClient.js";
import { RuleBasedMatcher } from "../matching/RuleBasedMatcher.js";
import { ScoringService } from "../matching/ScoringService.js";
import { activeSources } from "../sources/registry.js";
import { flagString, type parseFlags } from "./args.js";
import { formatBreakdown } from "./format.js";

/**
 * `jobs:match` — discover jobs, then print the transparent per-dimension score
 * breakdown for each (why a job scored what it did). Useful for tuning weights.
 */
export async function runMatch(flags: ReturnType<typeof parseFlags>): Promise<void> {
  const env = getEnv();
  const config = await loadSearchConfig();
  const candidate = await loadCandidate();

  const overrides: SearchOverrides = {
    query: flagString(flags, "query"),
    location: flagString(flags, "location"),
  };

  const discovery = new JobDiscoveryService(activeSources(env));
  const result = await discovery.discover(config, overrides);

  const matching = new JobMatchingService(
    new RuleBasedMatcher(),
    new ScoringService(),
    new LLMMatcher(createLLMClient(env), { enabled: env.ENABLE_LLM_MATCHING }),
    { llmMaxJobs: env.LLM_MAX_JOBS },
  );
  const matched = await matching.matchAll(result.jobs, candidate);

  process.stdout.write("\nMatch breakdown (accepted)\n\n");
  for (const m of matched.ranked) process.stdout.write(formatBreakdown(m) + "\n\n");

  if (matched.rejected.length) {
    process.stdout.write("Filtered out (rule-based)\n\n");
    for (const m of matched.rejected) process.stdout.write(formatBreakdown(m) + "\n\n");
  }

  process.stdout.write(
    `Summary: ${matched.ranked.length} accepted, ${matched.ruleFiltered} filtered, ${matched.llmEvaluated} LLM-evaluated.\n`,
  );
}
