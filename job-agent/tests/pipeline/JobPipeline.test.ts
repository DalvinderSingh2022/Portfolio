import { describe, expect, it } from "vitest";
import type { SearchConfig } from "../../src/domain/search.js";
import { JobDiscoveryService } from "../../src/discovery/JobDiscoveryService.js";
import { JobMatchingService } from "../../src/matching/JobMatchingService.js";
import { LLMMatcher } from "../../src/matching/LLMMatcher.js";
import { MockLLMClient } from "../../src/matching/llm/LLMClient.js";
import { RuleBasedMatcher } from "../../src/matching/RuleBasedMatcher.js";
import { ScoringService } from "../../src/matching/ScoringService.js";
import { ConsoleNotifier } from "../../src/notifications/ConsoleNotifier.js";
import { NotificationService } from "../../src/notifications/NotificationService.js";
import { JobPipeline } from "../../src/pipeline/JobPipeline.js";
import { MockJobSource } from "../../src/sources/mock/MockJobSource.js";
import { InMemoryStorage } from "../../src/storage/repositories/InMemoryStorage.js";
import { makeCandidate } from "../helpers.js";

const config: SearchConfig = {
  queries: ["React Developer", "Frontend Engineer", "Full Stack Developer"],
  locations: ["Remote", "Bangalore"],
  experience: { minYears: 0, maxYears: 3 },
  jobTypes: ["full-time", "internship"],
  resultsPerQuery: 25,
  perSource: {},
};

function buildTestPipeline(storage: InMemoryStorage, llmEnabled = false): JobPipeline {
  const discovery = new JobDiscoveryService([new MockJobSource()]);
  const matching = new JobMatchingService(
    new RuleBasedMatcher(),
    new ScoringService(),
    new LLMMatcher(new MockLLMClient(), { enabled: llmEnabled }),
    { llmMaxJobs: 10 },
  );
  const notifications = new NotificationService([new ConsoleNotifier()], storage, 70);
  return new JobPipeline(discovery, matching, notifications, storage, makeCandidate());
}

describe("JobPipeline (source → normalize → dedupe → match → save)", () => {
  it("runs end-to-end and persists jobs with match scores", async () => {
    const storage = new InMemoryStorage();
    const pipeline = buildTestPipeline(storage);
    const summary = await pipeline.run(config);

    expect(summary.found).toBeGreaterThan(0);
    expect(summary.topMatches.length).toBeGreaterThan(0);
    // Duplicated Acme repost should have collapsed.
    expect(summary.duplicates).toBeGreaterThanOrEqual(1);
    // Spam / expired / unrelated roles should have been filtered.
    expect(summary.filtered).toBeGreaterThanOrEqual(1);

    const stored = await storage.jobs.list();
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((j) => j.matchScore !== undefined)).toBe(true);

    // The top match should be a strong, relevant frontend role.
    const top = summary.topMatches[0]!;
    expect(top.match.finalScore).toBeGreaterThanOrEqual(70);
    expect(["highly_relevant", "relevant"]).toContain(top.match.recommendation);
  });

  it("records a SearchRun with tallies", async () => {
    const storage = new InMemoryStorage();
    await buildTestPipeline(storage).run(config);
    const runs = await storage.searchRuns.list();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.completedAt).toBeInstanceOf(Date);
    expect(runs[0]!.jobsFound).toBeGreaterThan(0);
  });

  it("does not double-notify the same job across two runs", async () => {
    const storage = new InMemoryStorage();
    const pipeline = buildTestPipeline(storage);
    const first = await pipeline.run(config);
    const second = await pipeline.run(config);
    expect(first.notificationsSent).toBeGreaterThan(0);
    expect(second.notificationsSent).toBe(0); // already alerted
  });

  it("uses the LLM stage (capped) when enabled and still ranks jobs", async () => {
    const storage = new InMemoryStorage();
    const summary = await buildTestPipeline(storage, true).run(config);
    expect(summary.topMatches.length).toBeGreaterThan(0);
    expect(summary.topMatches[0]!.match.method).toBe("rule+llm");
  });
});
