import { describe, expect, it } from "vitest";
import { derivePreferences } from "../../src/candidate/preferences.js";
import { RuleBasedMatcher } from "../../src/matching/RuleBasedMatcher.js";
import { hoursAgo, makeCandidate, makeJob } from "../helpers.js";

const matcher = new RuleBasedMatcher();
const prefs = derivePreferences(makeCandidate().profile);

describe("RuleBasedMatcher", () => {
  it("scores a strong, remote, on-target candidate highly and does not reject", () => {
    const job = makeJob({
      title: "React Developer",
      company: "Acme",
      location: "Remote",
      remoteType: "remote",
      employmentType: "Full-time",
      experienceRequired: "1-3 years",
      skills: ["React", "TypeScript", "Next.js", "REST APIs"],
      requirements: ["React", "TypeScript"],
      postedAt: hoursAgo(3),
    });
    const result = matcher.match(job, prefs);
    expect(result.rejected).toBe(false);
    expect(result.scores.role).toBeGreaterThanOrEqual(80);
    expect(result.scores.skills).toBeGreaterThanOrEqual(80);
    expect(result.scores.location).toBe(100);
    expect(result.scores.freshness).toBe(100);
    expect(result.details.matchedSkills).toContain("react");
  });

  it("gives a weak, unrelated role a low role score", () => {
    const job = makeJob({
      title: "Data Scientist",
      skills: ["Python", "TensorFlow", "Statistics"],
      remoteType: "remote",
      description: "Build ML models with Python.",
    });
    const result = matcher.match(job, prefs);
    expect(result.scores.role).toBeLessThan(40);
    expect(result.rejected).toBe(true); // unrelated role + no skill overlap
  });

  it("does NOT reject solely for a missing preferred skill, but records it", () => {
    const job = makeJob({
      title: "React Developer",
      remoteType: "remote",
      skills: ["React", "TypeScript", "AWS"], // AWS is neither owned nor related
      requirements: ["React"],
    });
    const result = matcher.match(job, prefs);
    expect(result.rejected).toBe(false);
    expect(result.details.missingSkills).toContain("aws");
    expect(result.details.warnings.join(" ")).toMatch(/missing skills/);
  });

  it("rejects a senior role requiring significantly more experience", () => {
    const job = makeJob({
      title: "Senior Staff Frontend Architect",
      remoteType: "onsite",
      location: "Bangalore, India",
      experienceRequired: "10+ years",
      skills: ["React", "TypeScript"],
    });
    const result = matcher.match(job, prefs);
    expect(result.rejected).toBe(true);
    expect(result.details.hardRejectReasons.join(" ")).toMatch(/more experience/);
  });

  it("gives full marks to a remote job on location", () => {
    const job = makeJob({ title: "Frontend Engineer", remoteType: "remote", skills: ["React"] });
    expect(matcher.match(job, prefs).scores.location).toBe(100);
  });

  it("rejects an onsite job in an unavailable location", () => {
    const job = makeJob({
      title: "Frontend Developer",
      remoteType: "onsite",
      location: "San Francisco, CA, USA",
      skills: ["React", "TypeScript"],
    });
    const result = matcher.match(job, prefs);
    expect(result.scores.location).toBeLessThan(20);
    expect(result.rejected).toBe(true);
    expect(result.details.hardRejectReasons.join(" ")).toMatch(/unavailable location/);
  });

  it("flags recruitment spam as rejected", () => {
    const job = makeJob({
      title: "WORK FROM HOME!!! Earn $5000/week — NO EXPERIENCE",
      remoteType: "remote",
      description: "No experience needed. Pay a small registration fee!!!",
    });
    expect(matcher.match(job, prefs).rejected).toBe(true);
  });

  it("does not treat a missing posting date as expired", () => {
    const job = makeJob({ title: "React Developer", remoteType: "remote", skills: ["React"], postedAt: undefined });
    expect(matcher.match(job, prefs).scores.freshness).toBe(60);
  });
});
