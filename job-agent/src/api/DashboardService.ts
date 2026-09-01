import { loadCandidate } from "../candidate/profile.js";
import type { CandidateProfile } from "../domain/candidate.js";
import type { JobFilter, SearchRunRecord, StatsSnapshot, Storage, StoredJob } from "../storage/repositories/types.js";

/**
 * A framework-agnostic query facade for the future dashboard/HTTP API. A thin
 * Express/Fastify layer (Phase 4) can map routes 1:1 onto these methods:
 *
 *   GET /api/jobs              -> listJobs(filter)
 *   GET /api/jobs/:id          -> getJob(id)
 *   GET /api/jobs/recommended  -> recommended(minScore)
 *   GET /api/jobs/search-runs  -> searchRuns()
 *   GET /api/jobs/stats        -> stats()
 *   GET /api/profile           -> profile()
 *
 * Keeping the query logic here (not in route handlers) means the API, CLI and
 * tests all share one implementation. Supported filters mirror the spec:
 * source, score, location, remote, company, skills, postedSince, employmentType, status.
 */
export class DashboardService {
  constructor(
    private readonly storage: Storage,
    private readonly minMatchScore: number,
  ) {}

  listJobs(filter: JobFilter = {}): Promise<StoredJob[]> {
    return this.storage.jobs.list(filter);
  }

  getJob(id: string): Promise<StoredJob | null> {
    return this.storage.jobs.get(id);
  }

  recommended(minScore = this.minMatchScore, limit = 20): Promise<StoredJob[]> {
    return this.storage.jobs.recommended(minScore, limit);
  }

  searchRuns(limit = 20): Promise<SearchRunRecord[]> {
    return this.storage.searchRuns.list(limit);
  }

  stats(): Promise<StatsSnapshot> {
    return this.storage.stats(this.minMatchScore);
  }

  async profile(): Promise<CandidateProfile> {
    return (await loadCandidate()).profile;
  }

  /** Parse dashboard query-string params into a typed JobFilter. */
  static parseFilter(query: Record<string, string | undefined>): JobFilter {
    const filter: JobFilter = {};
    if (query.source) filter.source = query.source as JobFilter["source"];
    if (query.score) filter.minScore = Number(query.score);
    if (query.minScore) filter.minScore = Number(query.minScore);
    if (query.maxScore) filter.maxScore = Number(query.maxScore);
    if (query.location) filter.location = query.location;
    if (query.remote) filter.remote = query.remote === "true";
    if (query.company) filter.company = query.company;
    if (query.skills) filter.skills = query.skills.split(",").map((s) => s.trim()).filter(Boolean);
    if (query.postedSince) filter.postedSince = new Date(query.postedSince);
    if (query.employmentType) filter.employmentType = query.employmentType;
    if (query.status) filter.status = query.status as JobFilter["status"];
    if (query.limit) filter.limit = Number(query.limit);
    if (query.offset) filter.offset = Number(query.offset);
    return filter;
  }
}
