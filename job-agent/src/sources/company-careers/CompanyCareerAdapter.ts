import type { JobSourceName, RawJob } from "../../domain/job.js";
import type { JobSearchCriteria } from "../../domain/search.js";
import { log } from "../../utils/logger.js";
import { normalizeText } from "../../utils/text.js";
import { BaseAdapter } from "../BaseAdapter.js";
import { FetchHttpClient, type HttpJsonClient } from "./ats/HttpClient.js";
import { GreenhouseClient } from "./ats/greenhouse.js";
import { LeverClient } from "./ats/lever.js";
import type { AtsClient, CompanyBoard } from "./ats/types.js";
import { loadCompanies } from "./companies.js";

export interface CompanyCareerDeps {
  http?: HttpJsonClient;
  clients?: AtsClient[];
  loadCompanies?: () => Promise<CompanyBoard[]>;
}

/**
 * Company career pages via their public ATS boards (Greenhouse `boards-api`,
 * Lever `postings-api`). These are documented, auth-free, programmatic
 * endpoints — the sanctioned path from the spec. One adapter covers many
 * companies; configure them in `data/sources/companies.json`.
 *
 * Each board is fetched at most once per run (memoized) and reused across the
 * many per-query/per-location searches, so we stay polite to the boards.
 * A single company failing never sinks the others or the pipeline.
 */
export class CompanyCareerAdapter extends BaseAdapter {
  readonly name: JobSourceName = "company-careers";
  protected readonly integrationNote =
    "Use public ATS job-board APIs (Greenhouse/Lever) or documented company feeds, configured per company.";

  private readonly http: HttpJsonClient;
  private readonly clients: Map<string, AtsClient>;
  private readonly loader: () => Promise<CompanyBoard[]>;
  private readonly logger = log("company-careers");

  /** Memoized per-run board fetches, keyed by `${ats}:${board}`. */
  private boardCache = new Map<string, Promise<RawJob[]>>();
  private companiesCache?: Promise<CompanyBoard[]>;

  constructor(enabled: boolean, deps: CompanyCareerDeps = {}) {
    super(enabled, 1200);
    this.http = deps.http ?? new FetchHttpClient();
    const clients = deps.clients ?? [new GreenhouseClient(), new LeverClient()];
    this.clients = new Map(clients.map((c) => [c.provider, c]));
    this.loader = deps.loadCompanies ?? loadCompanies;
  }

  protected override async doSearch(criteria: JobSearchCriteria): Promise<RawJob[]> {
    const companies = await this.companies();
    if (companies.length === 0) {
      this.logger.info("no companies configured — returning no jobs");
      return [];
    }

    // Fetch every configured board (memoized), isolating per-company failures.
    const perCompany = await Promise.all(
      companies.map(async (company) => {
        try {
          return await this.fetchCompany(company);
        } catch (error) {
          this.logger.warn(
            { company: company.name, ats: company.ats, err: (error as Error).message },
            "company board fetch failed (isolated)",
          );
          return [] as RawJob[];
        }
      }),
    );

    const all = perCompany.flat();
    const relevant = this.filterByQuery(all, criteria.query);
    const limit = criteria.limit ?? relevant.length;
    this.logger.info({ boards: companies.length, fetched: all.length, relevant: relevant.length }, "company-careers search");
    return relevant.slice(0, limit);
  }

  async getJobDetails(jobUrl: string): Promise<RawJob | null> {
    if (!this.enabled) return null;
    for (const client of this.clients.values()) {
      if (client.ownsUrl(jobUrl) && client.fetchOne) {
        await this.rateLimiter.wait();
        return client.fetchOne(jobUrl, this.http);
      }
    }
    return null;
  }

  private companies(): Promise<CompanyBoard[]> {
    if (!this.companiesCache) this.companiesCache = this.loader();
    return this.companiesCache;
  }

  private fetchCompany(company: CompanyBoard): Promise<RawJob[]> {
    const key = `${company.ats}:${company.board}`;
    const cached = this.boardCache.get(key);
    if (cached) return cached;
    const client = this.clients.get(company.ats);
    if (!client) {
      return Promise.reject(new Error(`no ATS client for provider "${company.ats}"`));
    }
    // Space out board fetches to be polite, then fetch once and cache.
    const promise = this.rateLimiter.wait().then(() => client.fetchBoard(company, this.http));
    this.boardCache.set(key, promise);
    return promise;
  }

  /** Keep only jobs whose title/description/team mention a query token. */
  private filterByQuery(jobs: RawJob[], query: string): RawJob[] {
    const tokens = normalizeText(query).split(" ").filter((t) => t.length >= 2);
    if (tokens.length === 0) return jobs;
    return jobs.filter((job) => {
      const haystack = normalizeText([job.title, job.description].filter(Boolean).join(" "));
      return tokens.some((t) => haystack.includes(t));
    });
  }
}
