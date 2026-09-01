import { describe, expect, it } from "vitest";
import { JobDeduplicator } from "../../src/discovery/JobDeduplicator.js";
import { makeJob } from "../helpers.js";

const dedup = new JobDeduplicator();

describe("JobDeduplicator", () => {
  it("merges the same job seen on two platforms and preserves both sources", () => {
    const a = makeJob({ title: "React Developer", company: "Acme", location: "Remote", source: "linkedin", applicationUrl: "https://acme.com/jobs/1" });
    const b = makeJob({ title: "Sr. React Developer", company: "Acme", location: "Remote, India", source: "naukri", applicationUrl: "https://acme.com/jobs/1?utm=x" });
    const { merged, duplicatesRemoved } = dedup.deduplicate([a, b]);
    expect(merged).toHaveLength(1);
    expect(duplicatesRemoved).toBe(1);
    expect(merged[0]!.sources.sort()).toEqual(["linkedin", "naukri"]);
    expect(merged[0]!.duplicateCount).toBe(2);
  });

  it("does NOT merge different roles at the same company", () => {
    const a = makeJob({ title: "React Developer", company: "Acme", location: "Remote" });
    const b = makeJob({ title: "DevOps Engineer", company: "Acme", location: "Remote" });
    expect(dedup.deduplicate([a, b]).merged).toHaveLength(2);
  });

  it("treats URL variations (query/fragment/trailing slash) as duplicates", () => {
    const a = makeJob({ title: "Frontend Engineer", company: "Beta", applicationUrl: "https://beta.com/careers/fe/" });
    const b = makeJob({ title: "Frontend Engineer II", company: "Beta", applicationUrl: "https://www.beta.com/careers/fe?ref=li#top" });
    expect(dedup.deduplicate([a, b]).merged).toHaveLength(1);
  });

  it("merges near-identical descriptions at the same company", () => {
    const desc = "We are hiring a frontend developer to build React apps with TypeScript, Next.js and Tailwind CSS working closely with design.";
    const a = makeJob({ title: "Frontend Developer", company: "Gamma", location: "Bangalore", description: desc, applicationUrl: "https://gamma.com/a" });
    const b = makeJob({ title: "Frontend Dev", company: "Gamma", location: "Bangalore", description: desc + " Great team.", applicationUrl: "https://boards.example.com/gamma-b" });
    expect(dedup.deduplicate([a, b]).merged).toHaveLength(1);
  });

  it("keeps distinct jobs at different companies apart", () => {
    const a = makeJob({ title: "React Developer", company: "Acme", location: "Remote" });
    const b = makeJob({ title: "React Developer", company: "Globex", location: "Remote" });
    expect(dedup.deduplicate([a, b]).merged).toHaveLength(2);
  });
});
