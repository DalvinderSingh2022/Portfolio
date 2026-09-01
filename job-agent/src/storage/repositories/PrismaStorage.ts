import { Prisma, PrismaClient } from "@prisma/client";
import type { ApplicationStatus, JobSourceName, MergedJob } from "../../domain/job.js";
import type { MatchResult } from "../../domain/matching.js";
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
 * PostgreSQL-backed storage via Prisma. Queryable columns power the dashboard
 * filters/analytics; a JSON `data` blob provides lossless hydration of the rich
 * StoredJob (avoiding brittle column-by-column mapping). Selected only when a
 * DATABASE_URL is configured — see `createStorage`.
 */
export class PrismaStorage implements Storage {
  readonly backend = "postgresql (prisma)";
  readonly jobs: JobRepository;
  readonly searchRuns: SearchRunRepository;
  readonly notifications: NotificationRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.jobs = new PrismaJobRepository(prisma);
    this.searchRuns = new PrismaSearchRunRepository(prisma);
    this.notifications = new PrismaNotificationRepository(prisma);
  }

  async stats(minHighScore: number): Promise<StatsSnapshot> {
    const [total, active, high, sightings, jobs, lastRun] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { active: true } }),
      this.prisma.job.count({ where: { matchScore: { gte: minHighScore } } }),
      this.prisma.jobSourceSighting.groupBy({ by: ["source"], _count: { source: true } }),
      this.prisma.job.findMany({ select: { recommendation: true, applicationStatus: true } }),
      this.prisma.searchRun.findFirst({ orderBy: { startedAt: "desc" } }),
    ]);

    const bySource: Record<string, number> = {};
    for (const row of sightings) bySource[row.source] = row._count.source;
    const byRecommendation: Record<string, number> = {};
    const byApplicationStatus: Record<string, number> = {};
    for (const j of jobs) {
      if (j.recommendation) byRecommendation[j.recommendation] = (byRecommendation[j.recommendation] ?? 0) + 1;
      byApplicationStatus[j.applicationStatus] = (byApplicationStatus[j.applicationStatus] ?? 0) + 1;
    }
    return {
      totalJobs: total,
      activeJobs: active,
      bySource,
      byRecommendation,
      byApplicationStatus,
      highMatches: high,
      lastRunAt: lastRun?.startedAt,
    };
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

/** Revive ISO date strings in a hydrated StoredJob JSON blob. */
function reviveStoredJob(data: unknown): StoredJob {
  const job = data as StoredJob;
  const dates: (keyof StoredJob)[] = ["postedAt", "discoveredAt", "firstSeenAt", "lastSeenAt"];
  const mutable = job as unknown as Record<string, unknown>;
  for (const key of dates) {
    const value = mutable[key as string];
    if (typeof value === "string") mutable[key as string] = new Date(value);
  }
  if (job.match?.evaluatedAt && typeof job.match.evaluatedAt === "string") {
    job.match.evaluatedAt = new Date(job.match.evaluatedAt);
  }
  return job;
}

class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertDiscovered(job: MergedJob, seenAt: Date): Promise<UpsertResult> {
    const existing = await this.prisma.job.findUnique({ where: { fingerprint: job.fingerprint } });

    if (existing) {
      const prev = reviveStoredJob(existing.data);
      const mergedSources = [...new Set([...prev.sources, ...job.sources])].sort() as JobSourceName[];
      const mergedSkills = [...new Set([...prev.skills, ...job.skills])];
      const description = job.description.length > prev.description.length ? job.description : prev.description;
      const updated: StoredJob = {
        ...prev,
        lastSeenAt: seenAt,
        active: true,
        sources: mergedSources,
        skills: mergedSkills,
        description,
        duplicateCount: prev.duplicateCount + job.duplicateCount,
      };
      await this.prisma.job.update({
        where: { id: existing.id },
        data: { lastSeenAt: seenAt, active: true, description, data: updated as object },
      });
      await this.writeSightingsAndSkills(existing.id, mergedSources, job, seenAt, mergedSkills);
      return { job: updated, isNew: false };
    }

    const stored: StoredJob = {
      ...job,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      active: true,
      applicationStatus: "discovered",
    };
    await this.prisma.job.create({
      data: {
        id: stored.id,
        fingerprint: stored.fingerprint,
        primarySource: stored.source,
        externalId: stored.externalId ?? null,
        title: stored.title,
        company: stored.company,
        location: stored.location ?? null,
        remoteType: stored.remoteType,
        employmentType: stored.employmentType ?? null,
        experienceRequired: stored.experienceRequired ?? null,
        salaryMin: stored.salary?.min ?? null,
        salaryMax: stored.salary?.max ?? null,
        salaryCurrency: stored.salary?.currency ?? null,
        description: stored.description,
        applicationUrl: stored.applicationUrl,
        sourceUrl: stored.sourceUrl,
        postedAt: stored.postedAt ?? null,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
        applicationStatus: "discovered",
        data: stored as object,
      },
    });
    await this.writeSightingsAndSkills(stored.id, stored.sources, job, seenAt, stored.skills);
    return { job: stored, isNew: true };
  }

  private async writeSightingsAndSkills(
    jobId: string,
    sources: JobSourceName[],
    job: MergedJob,
    seenAt: Date,
    skills: string[],
  ): Promise<void> {
    for (const source of sources) {
      await this.prisma.jobSourceSighting.upsert({
        where: { jobId_source: { jobId, source } },
        create: { jobId, source, externalId: job.externalId ?? null, url: job.sourceUrl, seenAt },
        update: { seenAt },
      });
    }
    for (const skill of skills) {
      await this.prisma.jobSkill.upsert({
        where: { jobId_skill: { jobId, skill } },
        create: { jobId, skill },
        update: {},
      });
    }
  }

  async saveMatch(jobId: string, match: MatchResult): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;
    const stored = reviveStoredJob(job.data);
    stored.match = match;
    stored.matchScore = match.finalScore;
    stored.recommendation = match.recommendation;
    await this.prisma.job.update({
      where: { id: jobId },
      data: { matchScore: match.finalScore, recommendation: match.recommendation, data: stored as object },
    });
    await this.prisma.jobMatch.upsert({
      where: { jobId_profileVersion: { jobId, profileVersion: 1 } },
      create: {
        jobId,
        finalScore: match.finalScore,
        recommendation: match.recommendation,
        method: match.method,
        scores: match.scores as object,
        weights: match.weights as object,
        details: match.details as object,
        llm: match.llm ? (match.llm as object) : Prisma.JsonNull,
        evaluatedAt: match.evaluatedAt,
      },
      update: {
        finalScore: match.finalScore,
        recommendation: match.recommendation,
        method: match.method,
        scores: match.scores as object,
        weights: match.weights as object,
        details: match.details as object,
        llm: match.llm ? (match.llm as object) : Prisma.JsonNull,
        evaluatedAt: match.evaluatedAt,
      },
    });
  }

  async setApplicationStatus(jobId: string, status: ApplicationStatus): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;
    const stored = reviveStoredJob(job.data);
    stored.applicationStatus = status;
    await this.prisma.job.update({ where: { id: jobId }, data: { applicationStatus: status, data: stored as object } });
  }

  async get(id: string): Promise<StoredJob | null> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    return job ? reviveStoredJob(job.data) : null;
  }

  async list(filter: JobFilter = {}): Promise<StoredJob[]> {
    const rows = await this.prisma.job.findMany({
      where: this.toWhere(filter),
      orderBy: { matchScore: "desc" },
      skip: filter.offset ?? 0,
      take: filter.limit ?? 100,
    });
    return rows.map((r) => reviveStoredJob(r.data));
  }

  async recommended(minScore: number, limit = 20): Promise<StoredJob[]> {
    return this.list({ minScore, limit });
  }

  async count(filter: JobFilter = {}): Promise<number> {
    return this.prisma.job.count({ where: this.toWhere(filter) });
  }

  private toWhere(f: JobFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (f.source) where.sources = { some: { source: f.source } };
    if (f.company) where.company = { contains: f.company, mode: "insensitive" };
    if (f.location) where.location = { contains: f.location, mode: "insensitive" };
    if (f.employmentType) where.employmentType = { equals: f.employmentType, mode: "insensitive" };
    if (f.status) where.applicationStatus = f.status;
    if (f.recommendation) where.recommendation = f.recommendation;
    if (f.remote !== undefined) where.remoteType = f.remote ? "remote" : { not: "remote" };
    if (f.postedSince) where.postedAt = { gte: f.postedSince };
    if (f.minScore !== undefined || f.maxScore !== undefined) {
      where.matchScore = {
        ...(f.minScore !== undefined ? { gte: f.minScore } : {}),
        ...(f.maxScore !== undefined ? { lte: f.maxScore } : {}),
      };
    }
    if (f.skills && f.skills.length > 0) {
      where.AND = f.skills.map((s) => ({ skills: { some: { skill: { equals: s, mode: "insensitive" } } } }));
    }
    return where;
  }
}

class PrismaSearchRunRepository implements SearchRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(run: Omit<SearchRunRecord, "id">): Promise<SearchRunRecord> {
    const row = await this.prisma.searchRun.create({
      data: {
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
        sources: run.sources,
        queries: run.queries,
        jobsFound: run.jobsFound,
        jobsNew: run.jobsNew,
        jobsDuplicate: run.jobsDuplicate,
        jobsRejected: run.jobsRejected,
        jobsShortlisted: run.jobsShortlisted,
        errors: run.errors as object,
      },
    });
    return this.toRecord(row);
  }

  async complete(id: string, patch: Partial<SearchRunRecord>): Promise<SearchRunRecord> {
    const row = await this.prisma.searchRun.update({
      where: { id },
      data: {
        completedAt: patch.completedAt ?? new Date(),
        ...(patch.jobsFound !== undefined ? { jobsFound: patch.jobsFound } : {}),
        ...(patch.jobsNew !== undefined ? { jobsNew: patch.jobsNew } : {}),
        ...(patch.jobsDuplicate !== undefined ? { jobsDuplicate: patch.jobsDuplicate } : {}),
        ...(patch.jobsRejected !== undefined ? { jobsRejected: patch.jobsRejected } : {}),
        ...(patch.jobsShortlisted !== undefined ? { jobsShortlisted: patch.jobsShortlisted } : {}),
        ...(patch.errors ? { errors: patch.errors as object } : {}),
      },
    });
    return this.toRecord(row);
  }

  async list(limit = 20): Promise<SearchRunRecord[]> {
    const rows = await this.prisma.searchRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
    return rows.map((r) => this.toRecord(r));
  }

  private toRecord(row: {
    id: string; startedAt: Date; completedAt: Date | null; sources: string[]; queries: string[];
    jobsFound: number; jobsNew: number; jobsDuplicate: number; jobsRejected: number; jobsShortlisted: number; errors: unknown;
  }): SearchRunRecord {
    return {
      id: row.id,
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? undefined,
      sources: row.sources,
      queries: row.queries,
      jobsFound: row.jobsFound,
      jobsNew: row.jobsNew,
      jobsDuplicate: row.jobsDuplicate,
      jobsRejected: row.jobsRejected,
      jobsShortlisted: row.jobsShortlisted,
      errors: (row.errors as { source: string; message: string }[]) ?? [],
    };
  }
}

class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(n: Omit<NotificationRecord, "id" | "createdAt">): Promise<NotificationRecord> {
    const row = await this.prisma.notification.create({
      data: { jobId: n.jobId, channel: n.channel, score: n.score, title: n.title, company: n.company },
    });
    return { ...row, channel: row.channel as NotificationRecord["channel"] };
  }

  async list(limit = 50): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((r) => ({ ...r, channel: r.channel as NotificationRecord["channel"] }));
  }

  async existsForJob(jobId: string): Promise<boolean> {
    return (await this.prisma.notification.count({ where: { jobId } })) > 0;
  }
}
