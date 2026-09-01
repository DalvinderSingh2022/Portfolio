import { randomUUID } from "node:crypto";
import type { ApplicationStatus, JobSourceName, MergedJob } from "../../domain/job.js";
import type { MatchResult } from "../../domain/matching.js";
import { normalizeText } from "../../utils/text.js";
import type {
  JobFilter,
  JobRepository,
  NotificationRecord,
  NotificationRepository,
  SearchRunRecord,
  SearchRunRepository,
  StatsSnapshot,
  Storage,
  StoredJob,
  UpsertResult,
} from "./types.js";

/**
 * A complete, dependency-free implementation of the storage surface. Used when
 * no DATABASE_URL is configured so the whole pipeline runs offline. Data lives
 * only for the process lifetime.
 */
export class InMemoryStorage implements Storage {
  readonly backend = "in-memory";
  readonly jobs: JobRepository;
  readonly searchRuns: SearchRunRepository;
  readonly notifications: NotificationRepository;

  private readonly jobStore = new Map<string, StoredJob>();
  /** fingerprint → canonical job id, so cross-source duplicates merge on write. */
  private readonly fingerprintIndex = new Map<string, string>();
  private readonly runStore: SearchRunRecord[] = [];
  private readonly notificationStore: NotificationRecord[] = [];

  constructor() {
    this.jobs = new InMemoryJobRepository(this.jobStore, this.fingerprintIndex);
    this.searchRuns = new InMemorySearchRunRepository(this.runStore);
    this.notifications = new InMemoryNotificationRepository(this.notificationStore);
  }

  async stats(minHighScore: number): Promise<StatsSnapshot> {
    const jobs = [...this.jobStore.values()];
    const bySource: Record<string, number> = {};
    const byRecommendation: Record<string, number> = {};
    const byApplicationStatus: Record<string, number> = {};
    for (const j of jobs) {
      for (const s of j.sources) bySource[s] = (bySource[s] ?? 0) + 1;
      if (j.recommendation) byRecommendation[j.recommendation] = (byRecommendation[j.recommendation] ?? 0) + 1;
      byApplicationStatus[j.applicationStatus] = (byApplicationStatus[j.applicationStatus] ?? 0) + 1;
    }
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.active).length,
      bySource,
      byRecommendation,
      byApplicationStatus,
      highMatches: jobs.filter((j) => (j.matchScore ?? 0) >= minHighScore).length,
      lastRunAt: this.runStore.at(-1)?.startedAt,
    };
  }

  async close(): Promise<void> {
    /* nothing to close */
  }
}

class InMemoryJobRepository implements JobRepository {
  constructor(
    private readonly store: Map<string, StoredJob>,
    private readonly fingerprintIndex: Map<string, string>,
  ) {}

  async upsertDiscovered(job: MergedJob, seenAt: Date): Promise<UpsertResult> {
    const existingId = this.store.has(job.id) ? job.id : this.fingerprintIndex.get(job.fingerprint);
    const existing = existingId ? this.store.get(existingId) : undefined;

    if (existing) {
      existing.lastSeenAt = seenAt;
      existing.active = true;
      existing.sources = [...new Set([...existing.sources, ...job.sources])].sort() as JobSourceName[];
      existing.duplicateCount += job.duplicateCount;
      // Prefer richer description / skills if the new sighting has more.
      if (job.description.length > existing.description.length) existing.description = job.description;
      existing.skills = [...new Set([...existing.skills, ...job.skills])];
      return { job: existing, isNew: false };
    }

    const stored: StoredJob = {
      ...job,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      active: true,
      applicationStatus: "discovered",
    };
    this.store.set(stored.id, stored);
    this.fingerprintIndex.set(stored.fingerprint, stored.id);
    return { job: stored, isNew: true };
  }

  async saveMatch(jobId: string, match: MatchResult): Promise<void> {
    const job = this.store.get(jobId);
    if (!job) return;
    job.match = match;
    job.matchScore = match.finalScore;
    job.recommendation = match.recommendation;
  }

  async setApplicationStatus(jobId: string, status: ApplicationStatus): Promise<void> {
    const job = this.store.get(jobId);
    if (job) job.applicationStatus = status;
  }

  async get(id: string): Promise<StoredJob | null> {
    return this.store.get(id) ?? null;
  }

  async list(filter: JobFilter = {}): Promise<StoredJob[]> {
    let jobs = [...this.store.values()].filter((j) => this.matches(j, filter));
    jobs.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? jobs.length;
    return jobs.slice(offset, offset + limit);
  }

  async recommended(minScore: number, limit = 20): Promise<StoredJob[]> {
    return this.list({ minScore, limit });
  }

  async count(filter: JobFilter = {}): Promise<number> {
    return [...this.store.values()].filter((j) => this.matches(j, filter)).length;
  }

  private matches(job: StoredJob, f: JobFilter): boolean {
    if (f.source && !job.sources.includes(f.source)) return false;
    if (f.minScore !== undefined && (job.matchScore ?? -1) < f.minScore) return false;
    if (f.maxScore !== undefined && (job.matchScore ?? 101) > f.maxScore) return false;
    if (f.remote !== undefined) {
      const isRemote = job.remoteType === "remote";
      if (isRemote !== f.remote) return false;
    }
    if (f.company && !normalizeText(job.company).includes(normalizeText(f.company))) return false;
    if (f.location && !normalizeText(job.location ?? "").includes(normalizeText(f.location))) return false;
    if (f.employmentType && normalizeText(job.employmentType ?? "") !== normalizeText(f.employmentType)) return false;
    if (f.status && job.applicationStatus !== f.status) return false;
    if (f.recommendation && job.recommendation !== f.recommendation) return false;
    if (f.postedSince && (!job.postedAt || job.postedAt < f.postedSince)) return false;
    if (f.skills && f.skills.length > 0) {
      const jobSkills = new Set(job.skills.map((s) => normalizeText(s)));
      if (!f.skills.every((s) => jobSkills.has(normalizeText(s)))) return false;
    }
    return true;
  }
}

class InMemorySearchRunRepository implements SearchRunRepository {
  constructor(private readonly store: SearchRunRecord[]) {}

  async create(run: Omit<SearchRunRecord, "id">): Promise<SearchRunRecord> {
    const record: SearchRunRecord = { ...run, id: randomUUID() };
    this.store.push(record);
    return record;
  }

  async complete(id: string, patch: Partial<SearchRunRecord>): Promise<SearchRunRecord> {
    const idx = this.store.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`SearchRun ${id} not found`);
    const updated = { ...this.store[idx]!, ...patch, id };
    this.store[idx] = updated;
    return updated;
  }

  async list(limit = 20): Promise<SearchRunRecord[]> {
    return [...this.store].reverse().slice(0, limit);
  }
}

class InMemoryNotificationRepository implements NotificationRepository {
  constructor(private readonly store: NotificationRecord[]) {}

  async create(n: Omit<NotificationRecord, "id" | "createdAt">): Promise<NotificationRecord> {
    const record: NotificationRecord = { ...n, id: randomUUID(), createdAt: new Date() };
    this.store.push(record);
    return record;
  }

  async list(limit = 50): Promise<NotificationRecord[]> {
    return [...this.store].reverse().slice(0, limit);
  }

  async existsForJob(jobId: string): Promise<boolean> {
    return this.store.some((n) => n.jobId === jobId);
  }
}
