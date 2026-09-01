import type { ApplicationStatus, JobSourceName, MergedJob } from "../../domain/job.js";
import type { MatchResult, Recommendation } from "../../domain/matching.js";

/** A job as persisted, with lifecycle + match metadata. */
export interface StoredJob extends MergedJob {
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Discovery lifecycle state (distinct from application status). */
  active: boolean;
  applicationStatus: ApplicationStatus;
  matchScore?: number;
  recommendation?: Recommendation;
  match?: MatchResult;
}

export interface JobFilter {
  source?: JobSourceName;
  minScore?: number;
  maxScore?: number;
  location?: string;
  remote?: boolean;
  company?: string;
  skills?: string[];
  postedSince?: Date;
  employmentType?: string;
  status?: ApplicationStatus;
  recommendation?: Recommendation;
  limit?: number;
  offset?: number;
}

export interface UpsertResult {
  job: StoredJob;
  isNew: boolean;
}

export interface JobRepository {
  /** Insert a freshly discovered job, or bump lastSeenAt / merge sources if seen before. */
  upsertDiscovered(job: MergedJob, seenAt: Date): Promise<UpsertResult>;
  saveMatch(jobId: string, match: MatchResult): Promise<void>;
  setApplicationStatus(jobId: string, status: ApplicationStatus): Promise<void>;
  get(id: string): Promise<StoredJob | null>;
  list(filter?: JobFilter): Promise<StoredJob[]>;
  recommended(minScore: number, limit?: number): Promise<StoredJob[]>;
  count(filter?: JobFilter): Promise<number>;
}

export interface SearchRunRecord {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  sources: string[];
  queries: string[];
  jobsFound: number;
  jobsNew: number;
  jobsDuplicate: number;
  jobsRejected: number;
  jobsShortlisted: number;
  errors: { source: string; message: string }[];
}

export interface SearchRunRepository {
  create(run: Omit<SearchRunRecord, "id">): Promise<SearchRunRecord>;
  complete(id: string, patch: Partial<SearchRunRecord>): Promise<SearchRunRecord>;
  list(limit?: number): Promise<SearchRunRecord[]>;
}

export interface NotificationRecord {
  id: string;
  jobId: string;
  channel: "console" | "email";
  score: number;
  createdAt: Date;
  title: string;
  company: string;
}

export interface NotificationRepository {
  create(n: Omit<NotificationRecord, "id" | "createdAt">): Promise<NotificationRecord>;
  list(limit?: number): Promise<NotificationRecord[]>;
  /** Has a notification already been sent for this job? (dedupe alerts) */
  existsForJob(jobId: string): Promise<boolean>;
}

export interface StatsSnapshot {
  totalJobs: number;
  activeJobs: number;
  bySource: Record<string, number>;
  byRecommendation: Record<string, number>;
  byApplicationStatus: Record<string, number>;
  highMatches: number;
  lastRunAt?: Date;
}

/** The full storage surface handed to the pipeline/CLI/API. */
export interface Storage {
  jobs: JobRepository;
  searchRuns: SearchRunRepository;
  notifications: NotificationRepository;
  stats(minHighScore: number): Promise<StatsSnapshot>;
  /** Human-readable description of the active backend (for logs/CLI). */
  readonly backend: string;
  close(): Promise<void>;
}
