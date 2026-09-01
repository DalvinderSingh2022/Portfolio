import { z } from "zod";

/**
 * Canonical list of job sources the system knows about. Adding a new source
 * means adding an entry here and an adapter — nothing else in the pipeline
 * needs to change.
 */
export const JOB_SOURCE_NAMES = [
  "mock",
  "linkedin",
  "indeed",
  "naukri",
  "wellfound",
  "glassdoor",
  "company-careers",
] as const;

export type JobSourceName = (typeof JOB_SOURCE_NAMES)[number];

export const RemoteTypeSchema = z.enum(["remote", "hybrid", "onsite", "unknown"]);
export type RemoteType = z.infer<typeof RemoteTypeSchema>;

export const SalarySchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
});
export type Salary = z.infer<typeof SalarySchema>;

/**
 * What a JobSource adapter emits. Intentionally loose: everything except a
 * source, title and a URL is optional, because raw scrapes/feeds are messy.
 * The JobNormalizer is responsible for turning this into a strict `Job`.
 */
export const RawJobSchema = z.object({
  source: z.enum(JOB_SOURCE_NAMES),
  externalId: z.string().optional(),
  title: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  remoteType: RemoteTypeSchema.optional(),
  employmentType: z.string().optional(),
  experienceRequired: z.string().optional(),
  salary: SalarySchema.optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  postedAt: z.union([z.date(), z.string()]).optional(),
  applicationUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
});
export type RawJob = z.infer<typeof RawJobSchema>;

/**
 * The normalized, validated job every source eventually produces.
 * `fingerprint` is deterministic and drives deduplication.
 */
export const JobSchema = z.object({
  id: z.string().min(1),
  source: z.enum(JOB_SOURCE_NAMES),
  externalId: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  remoteType: RemoteTypeSchema.default("unknown"),
  employmentType: z.string().optional(),
  experienceRequired: z.string().optional(),
  salary: SalarySchema.optional(),
  description: z.string(),
  requirements: z.array(z.string()),
  responsibilities: z.array(z.string()),
  skills: z.array(z.string()),
  postedAt: z.date().optional(),
  applicationUrl: z.string().min(1),
  sourceUrl: z.string().min(1),
  discoveredAt: z.date(),
  fingerprint: z.string().min(1),
});
export type Job = z.infer<typeof JobSchema>;

/**
 * A normalized job that may have been observed on more than one platform.
 * Deduplication merges duplicate `Job`s into one of these, preserving every
 * source it was seen on rather than discarding records.
 */
export interface MergedJob extends Job {
  /** Every source this position was discovered on (deduped, sorted). */
  sources: JobSourceName[];
  /** How many raw records collapsed into this one. */
  duplicateCount: number;
}

export type ApplicationStatus =
  | "discovered"
  | "reviewing"
  | "shortlisted"
  | "rejected"
  | "applied"
  | "interview"
  | "offer"
  | "closed";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "discovered",
  "reviewing",
  "shortlisted",
  "rejected",
  "applied",
  "interview",
  "offer",
  "closed",
];
