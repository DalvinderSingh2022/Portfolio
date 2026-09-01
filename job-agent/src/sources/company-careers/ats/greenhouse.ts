import type { RawJob } from "../../../domain/job.js";
import { htmlToText } from "../../../utils/html.js";
import type { HttpJsonClient } from "./HttpClient.js";
import type { AtsClient, CompanyBoard } from "./types.js";

/** Shape of a Greenhouse job-board API job (fields we consume). */
export interface GreenhouseJob {
  id: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  absolute_url: string;
  location?: { name?: string } | null;
  content?: string; // HTML, entity-encoded (present when content=true)
  company_name?: string;
  departments?: Array<{ name?: string }>;
  offices?: Array<{ name?: string }>;
}

export interface GreenhouseListResponse {
  jobs: GreenhouseJob[];
  meta?: { total?: number };
}

const BASE = "https://boards-api.greenhouse.io/v1/boards";

/**
 * Greenhouse job-board API client. This is a public, documented endpoint meant
 * for programmatic consumption — no auth, no scraping.
 * Docs: https://developers.greenhouse.io/job-board.html
 */
export class GreenhouseClient implements AtsClient {
  readonly provider = "greenhouse" as const;

  async fetchBoard(company: CompanyBoard, http: HttpJsonClient): Promise<RawJob[]> {
    // content=true returns each job's HTML description in one request (no N+1).
    const url = `${BASE}/${encodeURIComponent(company.board)}/jobs?content=true`;
    const data = await http.getJson<GreenhouseListResponse>(url);
    return (data.jobs ?? []).map((job) => mapGreenhouseJob(job, company.name));
  }

  ownsUrl(url: string): boolean {
    return /greenhouse\.io\//i.test(url);
  }

  async fetchOne(url: string, http: HttpJsonClient): Promise<RawJob | null> {
    // Parse board + job id from a boards.greenhouse.io/{board}/jobs/{id} URL.
    const m = url.match(/greenhouse\.io\/(?:embed\/job_app\?token=|[^/]*\/)?([a-z0-9_-]+)\/jobs\/(\d+)/i);
    if (!m) return null;
    const [, board, id] = m;
    const data = await http.getJson<GreenhouseJob>(
      `${BASE}/${encodeURIComponent(board!)}/jobs/${id}?questions=false`,
    );
    return mapGreenhouseJob(data, data.company_name ?? board!);
  }
}

/** Pure mapper: Greenhouse job -> RawJob. Exported for unit tests. */
export function mapGreenhouseJob(job: GreenhouseJob, companyName: string): RawJob {
  const offices = (job.offices ?? []).map((o) => o.name?.trim()).filter(Boolean) as string[];
  const location = job.location?.name?.trim() || offices.join(", ") || undefined;
  const posted = job.first_published || job.updated_at;
  const departments = (job.departments ?? []).map((d) => d.name).filter(Boolean).join(", ");
  const description = htmlToText(job.content);

  return {
    source: "company-careers",
    externalId: `greenhouse:${job.id}`,
    title: job.title.trim(),
    company: companyName,
    location,
    // remoteType left undefined — the normalizer infers it from title/location/description.
    description: departments ? `${description}\n\nTeam: ${departments}` : description,
    requirements: [],
    responsibilities: [],
    skills: [],
    postedAt: posted ? new Date(posted) : undefined,
    applicationUrl: job.absolute_url,
    sourceUrl: job.absolute_url,
  };
}
