import type { CandidateProfile } from "../../domain/candidate.js";
import type { MergedJob } from "../../domain/job.js";
import { RECOMMENDATIONS } from "../../domain/matching.js";

export interface LLMPrompt {
  system: string;
  user: string;
}

/**
 * The ONE place the job-matching prompt lives. Keeping prompts out of business
 * logic makes them reviewable and versionable. The prompt is deliberately
 * strict about never inventing candidate experience.
 */
export function buildJobMatchPrompt(profile: CandidateProfile, resume: string, job: MergedJob): LLMPrompt {
  const system = [
    "You are a precise technical recruiter assistant.",
    "You compare ONE candidate against ONE job and output a strict JSON verdict.",
    "Rules you must follow:",
    "- Judge ONLY on the candidate profile and resume provided. NEVER invent skills or experience.",
    "- If a skill is not present in the candidate's profile/resume, treat it as missing/unknown.",
    "- Do not reward a job for asking skills the candidate lacks.",
    `- 'recommendation' must be exactly one of: ${RECOMMENDATIONS.join(", ")}.`,
    "- All *Match fields and overallScore are integers 0-100. 'confidence' is a float 0-1.",
    "- Respond with JSON ONLY. No markdown, no commentary.",
  ].join("\n");

  const user = [
    "## Candidate Profile (JSON)",
    JSON.stringify(
      {
        name: profile.name,
        location: profile.location,
        experienceYears: profile.experienceYears,
        skills: profile.skills,
        preferredRoles: profile.preferredRoles,
        preferredLocations: profile.preferredLocations,
        employmentTypes: profile.employmentTypes,
      },
      null,
      2,
    ),
    "",
    "## Candidate Resume (markdown)",
    resume || "(no resume provided)",
    "",
    "## Job",
    JSON.stringify(
      {
        title: job.title,
        company: job.company,
        location: job.location,
        remoteType: job.remoteType,
        employmentType: job.employmentType,
        experienceRequired: job.experienceRequired,
        skills: job.skills,
        requirements: job.requirements,
        description: job.description.slice(0, 4000),
      },
      null,
      2,
    ),
    "",
    "## Required JSON shape",
    JSON.stringify(
      {
        overallScore: 0,
        skillsMatch: 0,
        experienceMatch: 0,
        roleMatch: 0,
        locationMatch: 0,
        confidence: 0,
        strengths: [""],
        gaps: [""],
        redFlags: [""],
        recommendation: "possible",
      },
      null,
      2,
    ),
  ].join("\n");

  return { system, user };
}
