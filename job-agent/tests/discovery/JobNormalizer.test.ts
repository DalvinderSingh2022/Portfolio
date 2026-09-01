import { describe, expect, it } from "vitest";
import { JobNormalizer } from "../../src/discovery/JobNormalizer.js";

const normalizer = new JobNormalizer();

describe("JobNormalizer", () => {
  it("produces a stable fingerprint from company + title + location", () => {
    const fp1 = normalizer.fingerprint("Acme Web", "Sr. React Developer", "Remote, India");
    const fp2 = normalizer.fingerprint("acme web", "React Developer", "remote india");
    expect(fp1).toBe(fp2); // seniority + punctuation + order noise removed
  });

  it("infers remote type from text when not provided", () => {
    const r = normalizer.normalize({
      source: "mock",
      title: "Frontend Developer",
      company: "X",
      description: "This is a fully remote position.",
      applicationUrl: "https://x.com/a",
      sourceUrl: "https://x.com/s",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.job.remoteType).toBe("remote");
  });

  it("rejects jobs with no title", () => {
    const r = normalizer.normalize({ source: "mock", title: "", applicationUrl: "https://x.com/a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/title/);
  });

  it("rejects jobs with no url", () => {
    const r = normalizer.normalize({ source: "mock", title: "Developer" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/url/);
  });

  it("dedupes skills and fills defaults", () => {
    const r = normalizer.normalize({
      source: "mock",
      title: "Dev",
      company: "Y",
      skills: ["React", "react", "TypeScript"],
      applicationUrl: "https://y.com/a",
      sourceUrl: "https://y.com/s",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.job.skills).toEqual(["React", "TypeScript"]);
      expect(r.job.remoteType).toBe("unknown");
      expect(r.job.requirements).toEqual([]);
    }
  });
});
