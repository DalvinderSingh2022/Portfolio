import {
  DEFAULT_WEIGHTS,
  scoreToRecommendation,
  type DimensionScores,
  type LLMMatchResult,
  type MatchResult,
  type RuleMatchResult,
  type ScoreDimension,
} from "../domain/matching.js";

export interface ScoringConfig {
  weights: DimensionScores;
  /** How much the LLM's sub-scores pull the final score (0..1). 0 = ignore LLM. */
  llmBlend: number;
}

/**
 * Transparent, configurable scoring. Combines the per-dimension rule scores
 * (and, when available, the LLM's sub-scores) into a single 0..100 score and a
 * recommendation band. Every individual dimension score is preserved on the
 * result — the final number is never a black box.
 */
export class ScoringService {
  private readonly weights: DimensionScores;
  private readonly llmBlend: number;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.weights = normalizeWeights(config.weights ?? DEFAULT_WEIGHTS);
    this.llmBlend = clamp01(config.llmBlend ?? 0.5);
  }

  score(jobId: string, rule: RuleMatchResult, llm?: LLMMatchResult, evaluatedAt: Date = new Date()): MatchResult {
    const scores: DimensionScores = { ...rule.scores };

    if (llm) {
      // Blend LLM opinion into the four dimensions it evaluates.
      scores.role = blend(scores.role, llm.roleMatch, this.llmBlend);
      scores.skills = blend(scores.skills, llm.skillsMatch, this.llmBlend);
      scores.experience = blend(scores.experience, llm.experienceMatch, this.llmBlend);
      scores.location = blend(scores.location, llm.locationMatch, this.llmBlend);
    }

    let finalScore = weightedSum(scores, this.weights);

    // Hard rejections and LLM red flags cannot be out-scored by other dimensions.
    let recommendation = scoreToRecommendation(finalScore);
    if (rule.rejected) {
      recommendation = "reject";
      finalScore = Math.min(finalScore, 40);
    } else if (llm && llm.recommendation === "reject") {
      recommendation = "reject";
      finalScore = Math.min(finalScore, 45);
    }

    return {
      jobId,
      finalScore: Math.round(finalScore),
      recommendation,
      scores,
      weights: this.weights,
      details: rule.details,
      llm,
      method: llm ? "rule+llm" : "rule-based",
      evaluatedAt,
    };
  }
}

function weightedSum(scores: DimensionScores, weights: DimensionScores): number {
  let total = 0;
  let weightTotal = 0;
  for (const dim of Object.keys(weights) as ScoreDimension[]) {
    total += scores[dim] * weights[dim];
    weightTotal += weights[dim];
  }
  return weightTotal === 0 ? 0 : total / weightTotal;
}

function normalizeWeights(weights: DimensionScores): DimensionScores {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return { ...DEFAULT_WEIGHTS };
  const out = {} as DimensionScores;
  for (const dim of Object.keys(weights) as ScoreDimension[]) out[dim] = weights[dim] / sum;
  return out;
}

function blend(rule: number, llm: number, weight: number): number {
  return rule * (1 - weight) + llm * weight;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
