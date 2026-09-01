import { describe, expect, it } from "vitest";
import type { JobSourceName, RawJob } from "../../src/domain/job.js";
import type { SearchConfig } from "../../src/domain/search.js";
import { JobDiscoveryService } from "../../src/discovery/JobDiscoveryService.js";
import type { JobSource } from "../../src/sources/JobSource.js";
import { MockJobSource } from "../../src/sources/mock/MockJobSource.js";

class AlwaysFailingSource implements JobSource {
  readonly name: JobSourceName = "indeed";
  readonly enabled = true;
  async searchJobs(): Promise<RawJob[]> {
    throw new Error("simulated source outage");
  }
}

const config: SearchConfig = {
  queries: ["React Developer"],
  locations: ["Remote"],
  experience: { minYears: 0, maxYears: 3 },
  jobTypes: ["full-time"],
  resultsPerQuery: 25,
  perSource: {},
};

describe("source failure isolation", () => {
  it("continues discovery when one source fails and records the error", async () => {
    const service = new JobDiscoveryService([new AlwaysFailingSource(), new MockJobSource()]);
    const result = await service.discover(config);

    // Mock still returned jobs despite Indeed failing.
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.source).toBe("indeed");
    expect(result.errors[0]!.message).toMatch(/outage/);
  });

  it("returns no jobs and one error when the ONLY source fails (no throw)", async () => {
    const service = new JobDiscoveryService([new AlwaysFailingSource()]);
    const result = await service.discover(config);
    expect(result.jobs).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});
