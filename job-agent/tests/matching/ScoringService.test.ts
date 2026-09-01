import { describe, expect, it } from "vitest";
import type { DimensionScores, RuleMatchResult } from "../../src/domain/matching.js";
import { ScoringService } from "../../src/matching/ScoringService.js";

function rule(scores: Partial<DimensionScores>, rejected = false): RuleMatchResult {
  return {
    scores: { role: 0, skills: 0, experience: 0, location: 0, employment: 0, salary: 0, freshness: 0, ...scores },
    details: {
      matchedSkills: [], relatedSkills: [], missingSkills: [], experienceCandidate: 2,
      locationMatch: false, employmentMatch: false, hardRejectReasons: rejected ? ["x"] : [], warnings: [],
    },
    rejected,
  };
}

describe("ScoringService", () => {
  const service = new ScoringService();

  it("is deterministic and computes the weighted sum with default weights", () => {
    const perfect = rule({ role: 100, skills: 100, experience: 100, location: 100, employment: 100, salary: 100, freshness: 100 });
    const a = service.score("j1", perfect);
    const b = service.score("j1", perfect);
    expect(a.finalScore).toBe(100);
    expect(a.finalScore).toBe(b.finalScore);
    expect(a.recommendation).toBe("highly_relevant");
  });

  it("maps score bands to recommendations", () => {
    // role/skills dominate (0.25 + 0.30). Tune to land in each band.
    const weak = service.score("j", rule({ role: 60, skills: 60, experience: 60, location: 60, employment: 60, salary: 60, freshness: 60 }));
    expect(weak.finalScore).toBe(60);
    expect(weak.recommendation).toBe("weak");

    const possible = service.score("j", rule({ role: 70, skills: 70, experience: 70, location: 70, employment: 70, salary: 70, freshness: 70 }));
    expect(possible.recommendation).toBe("possible");
  });

  it("preserves individual dimension scores and weights on the result", () => {
    const r = service.score("j", rule({ role: 80, skills: 90 }));
    expect(r.scores.skills).toBe(90);
    expect(Object.values(r.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("forces reject and caps the score when a hard rule fired", () => {
    const r = service.score("j", rule({ role: 100, skills: 100, experience: 100, location: 100, employment: 100, salary: 100, freshness: 100 }, true));
    expect(r.recommendation).toBe("reject");
    expect(r.finalScore).toBeLessThanOrEqual(40);
  });

  it("honors custom weights", () => {
    const service2 = new ScoringService({ weights: { role: 1, skills: 0, experience: 0, location: 0, employment: 0, salary: 0, freshness: 0 } });
    const r = service2.score("j", rule({ role: 42, skills: 100 }));
    expect(r.finalScore).toBe(42); // only role is weighted
  });

  it("blends LLM sub-scores when provided", () => {
    const r = service.score(
      "j",
      rule({ role: 50, skills: 50, experience: 50, location: 50, employment: 50, salary: 50, freshness: 50 }),
      { overallScore: 90, skillsMatch: 100, experienceMatch: 100, roleMatch: 100, locationMatch: 100, confidence: 0.9, strengths: [], gaps: [], redFlags: [], recommendation: "highly_relevant" },
    );
    expect(r.method).toBe("rule+llm");
    expect(r.scores.skills).toBeGreaterThan(50); // pulled up by the LLM
  });
});
