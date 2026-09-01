import { z } from "zod";

export const RECOMMENDATIONS = [
  "highly_relevant",
  "relevant",
  "possible",
  "weak",
  "reject",
] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

/** The transparent scoring dimensions. Each is scored 0..100 independently. */
export const SCORE_DIMENSIONS = [
  "role",
  "skills",
  "experience",
  "location",
  "employment",
  "salary",
  "freshness",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type DimensionScores = Record<ScoreDimension, number>;

/** Default weights (sum = 1.0). Overridable via ScoringService config. */
export const DEFAULT_WEIGHTS: DimensionScores = {
  role: 0.25,
  skills: 0.3,
  experience: 0.2,
  location: 0.1,
  employment: 0.05,
  salary: 0.05,
  freshness: 0.05,
};

/**
 * Details produced by the rule-based matcher. Kept alongside the numeric
 * scores so recommendations are explainable and auditable.
 */
export interface RuleMatchDetails {
  matchedSkills: string[];
  relatedSkills: string[];
  missingSkills: string[];
  matchedRole?: string;
  experienceCandidate: number;
  experienceRequired?: { min?: number; max?: number };
  locationMatch: boolean;
  employmentMatch: boolean;
  /** Hard rejections detected by rules (e.g. senior role, expired, spam). */
  hardRejectReasons: string[];
  /** Soft warnings that do not reject but lower confidence. */
  warnings: string[];
}

export interface RuleMatchResult {
  scores: DimensionScores;
  details: RuleMatchDetails;
  /** True when a rule fired that should drop the job before the LLM stage. */
  rejected: boolean;
}

/** Strict shape the LLM must return. Validated with this schema — never trusted raw. */
export const LLMMatchResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skillsMatch: z.number().min(0).max(100),
  experienceMatch: z.number().min(0).max(100),
  roleMatch: z.number().min(0).max(100),
  locationMatch: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  redFlags: z.array(z.string()),
  recommendation: z.enum(RECOMMENDATIONS),
});
export type LLMMatchResult = z.infer<typeof LLMMatchResultSchema>;

/** The final, combined match for one job against the candidate. */
export interface MatchResult {
  jobId: string;
  finalScore: number;
  recommendation: Recommendation;
  scores: DimensionScores;
  weights: DimensionScores;
  details: RuleMatchDetails;
  llm?: LLMMatchResult;
  /** Provenance for the score: which stages contributed. */
  method: "rule-based" | "rule+llm";
  evaluatedAt: Date;
}

/** A job paired with its computed match result. */
export interface MatchedJob {
  job: import("./job.js").MergedJob;
  match: MatchResult;
}

/** Map a 0..100 final score to a recommendation band. */
export function scoreToRecommendation(score: number): Recommendation {
  if (score < 50) return "reject";
  if (score < 65) return "weak";
  if (score < 75) return "possible";
  if (score < 85) return "relevant";
  return "highly_relevant";
}
