import type { MergedJob } from "../../domain/job.js";
import type { LLMPrompt } from "./job-match.prompt.js";

/**
 * Phase-3 prompt: classify a job (function, seniority, spam-likelihood) as a
 * cheap pre-filter signal. Lives alongside the other prompts by design.
 */
export function buildJobClassificationPrompt(job: MergedJob): LLMPrompt {
  const system = [
    "You classify a job posting. Return JSON ONLY:",
    '{ "function": string, "seniority": "intern"|"junior"|"mid"|"senior"|"lead"|"unknown",',
    '  "isSpam": boolean, "confidence": number }',
  ].join("\n");
  const user = `Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description.slice(0, 2000)}`;
  return { system, user };
}
