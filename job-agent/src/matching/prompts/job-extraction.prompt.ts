import type { LLMPrompt } from "./job-match.prompt.js";

/**
 * Phase-3 prompt: extract structured fields (skills, requirements, seniority,
 * salary) from a raw/unstructured job description when a source provides only
 * free text. Kept here so all LLM prompts live in one directory.
 */
export function buildJobExtractionPrompt(rawDescription: string): LLMPrompt {
  const system = [
    "You extract structured data from a job description.",
    "Return JSON ONLY with keys: title, company, location, remoteType, employmentType,",
    "experienceRequired, skills (string[]), requirements (string[]), responsibilities (string[]).",
    "Do not invent facts that are not present in the text; use null/[] when unknown.",
  ].join("\n");
  const user = `## Job Description\n${rawDescription.slice(0, 6000)}`;
  return { system, user };
}
