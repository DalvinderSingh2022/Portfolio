import type { CandidateProfile } from "../domain/candidate.js";
import { normalizeText } from "../utils/text.js";

/**
 * A small, curated skill-adjacency map used to award partial credit for
 * "related" skills the candidate has when a job asks for a neighbor. This is not
 * meant to be exhaustive — it is configurable data, kept out of business logic.
 */
export const RELATED_SKILLS: Record<string, string[]> = {
  react: ["next.js", "redux", "react native", "javascript", "typescript"],
  "next.js": ["react", "javascript", "typescript"],
  javascript: ["typescript", "node.js", "react"],
  typescript: ["javascript", "node.js", "react"],
  "node.js": ["express", "javascript", "typescript", "nest.js"],
  express: ["node.js", "rest apis"],
  mongodb: ["nosql", "mongoose"],
  postgresql: ["sql", "mysql", "prisma"],
  "rest apis": ["graphql", "express", "http"],
  "tailwind css": ["css", "html", "styled-components"],
  git: ["github", "gitlab", "version control"],
};

export interface CandidatePreferences {
  skills: Set<string>;
  relatedSkills: Set<string>;
  preferredRoleTokens: string[][];
  preferredRolesRaw: string[];
  preferredLocations: Set<string>;
  employmentTypes: Set<string>;
  experienceYears: number;
  minimumMatchScore: number;
  salaryExpectation?: { min?: number; max?: number; currency?: string };
}

/** Derive normalized, lookup-friendly preference structures from a profile. */
export function derivePreferences(profile: CandidateProfile): CandidatePreferences {
  const skills = new Set(profile.skills.map((s) => normalizeText(s)));

  const relatedSkills = new Set<string>();
  for (const skill of skills) {
    for (const related of RELATED_SKILLS[skill] ?? []) {
      const norm = normalizeText(related);
      if (!skills.has(norm)) relatedSkills.add(norm);
    }
  }

  return {
    skills,
    relatedSkills,
    preferredRoleTokens: profile.preferredRoles.map((r) => normalizeText(r).split(" ").filter(Boolean)),
    preferredRolesRaw: profile.preferredRoles,
    preferredLocations: new Set(profile.preferredLocations.map((l) => normalizeText(l))),
    employmentTypes: new Set(profile.employmentTypes.map((e) => normalizeText(e))),
    experienceYears: profile.experienceYears,
    minimumMatchScore: profile.minimumMatchScore,
    salaryExpectation: profile.salaryExpectation,
  };
}
