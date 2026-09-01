import type { CandidateProfile, LoadedCandidate } from "../src/domain/candidate.js";
import type { MergedJob } from "../src/domain/job.js";
import { JobNormalizer } from "../src/discovery/JobNormalizer.js";

const normalizer = new JobNormalizer();

export function makeCandidate(overrides: Partial<CandidateProfile> = {}): LoadedCandidate {
  const profile: CandidateProfile = {
    version: 1,
    name: "Test Candidate",
    location: "New Delhi, India",
    experienceYears: 2,
    education: { degree: "B.Tech Computer Science" },
    skills: ["JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express", "MongoDB", "PostgreSQL", "REST APIs", "Tailwind CSS", "Git"],
    preferredRoles: ["Frontend Developer", "Frontend Engineer", "React Developer", "Full Stack Developer", "Software Engineer"],
    preferredLocations: ["Remote", "India", "New Delhi", "Bangalore", "Hyderabad", "Gurgaon"],
    employmentTypes: ["Full-time", "Internship"],
    minimumMatchScore: 70,
    ...overrides,
  };
  return { profile, resume: "Frontend developer with React, TypeScript, Node.js." };
}

/** Build a MergedJob by normalizing a raw-ish partial and adding merge metadata. */
export function makeJob(overrides: Partial<MergedJob> & { title: string; company?: string }): MergedJob {
  const result = normalizer.normalize(
    {
      source: overrides.source ?? "mock",
      title: overrides.title,
      company: overrides.company ?? "Test Co",
      location: overrides.location,
      remoteType: overrides.remoteType,
      employmentType: overrides.employmentType,
      experienceRequired: overrides.experienceRequired,
      salary: overrides.salary,
      description: overrides.description ?? "A job doing things.",
      requirements: overrides.requirements,
      responsibilities: overrides.responsibilities,
      skills: overrides.skills,
      postedAt: overrides.postedAt,
      applicationUrl:
        overrides.applicationUrl ??
        `https://example.com/${encodeURIComponent(overrides.company ?? "Test Co")}/${encodeURIComponent(overrides.title)}`,
      sourceUrl:
        overrides.sourceUrl ??
        `https://example.com/src/${encodeURIComponent(overrides.company ?? "Test Co")}/${encodeURIComponent(overrides.title)}`,
      externalId: overrides.externalId,
    },
    overrides.discoveredAt ?? new Date(),
  );
  if (!result.ok) throw new Error(`fixture failed to normalize: ${result.reason}`);
  return {
    ...result.job,
    sources: overrides.sources ?? [result.job.source],
    duplicateCount: overrides.duplicateCount ?? 1,
  };
}

export function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}
