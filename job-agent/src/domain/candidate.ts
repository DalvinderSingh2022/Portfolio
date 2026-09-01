import { z } from "zod";

export const EducationSchema = z.object({
  degree: z.string().optional(),
  field: z.string().optional(),
  institution: z.string().optional(),
});

export const CandidateProfileSchema = z.object({
  /**
   * Bumped whenever the profile/resume materially changes. Used together with a
   * job fingerprint to key the LLM-match cache so stale evaluations are not
   * reused after the candidate's profile evolves.
   */
  version: z.number().int().positive().default(1),
  name: z.string(),
  location: z.string().optional(),
  experienceYears: z.number().nonnegative().default(0),
  education: EducationSchema.optional(),
  skills: z.array(z.string()).default([]),
  preferredRoles: z.array(z.string()).default([]),
  preferredLocations: z.array(z.string()).default([]),
  employmentTypes: z.array(z.string()).default([]),
  salaryExpectation: z
    .object({
      min: z.number().nonnegative().optional(),
      max: z.number().nonnegative().optional(),
      currency: z.string().optional(),
    })
    .optional(),
  /** Jobs scoring below this are not surfaced as recommendations. */
  minimumMatchScore: z.number().min(0).max(100).default(70),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export interface LoadedCandidate {
  profile: CandidateProfile;
  /** Raw resume text (markdown). Fed to the LLM matcher when enabled. */
  resume: string;
}
