import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CompanyCareerAdapter } from "../../src/sources/company-careers/CompanyCareerAdapter.js";
import { HttpError, type HttpJsonClient } from "../../src/sources/company-careers/ats/HttpClient.js";
import { GreenhouseClient, mapGreenhouseJob, type GreenhouseJob } from "../../src/sources/company-careers/ats/greenhouse.js";
import { LeverClient, mapLeverPosting, type LeverPosting } from "../../src/sources/company-careers/ats/lever.js";
import type { CompanyBoard } from "../../src/sources/company-careers/ats/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const ghBoard = JSON.parse(readFileSync(resolve(here, "../fixtures/greenhouse.board.json"), "utf8")) as {
  jobs: GreenhouseJob[];
};
const leverBoard = JSON.parse(readFileSync(resolve(here, "../fixtures/lever.board.json"), "utf8")) as LeverPosting[];

/** Fake HTTP client that serves fixtures by URL and counts calls. */
class FakeHttp implements HttpJsonClient {
  calls: string[] = [];
  constructor(private readonly routes: Array<{ match: RegExp; payload: unknown; fail?: number }>) {}
  async getJson<T>(url: string): Promise<T> {
    this.calls.push(url);
    const route = this.routes.find((r) => r.match.test(url));
    if (!route) throw new HttpError(404, `no fixture for ${url}`);
    if (route.fail) throw new HttpError(route.fail, `simulated ${route.fail}`);
    return route.payload as T;
  }
}

const companies: CompanyBoard[] = [
  { name: "Acme (GH)", ats: "greenhouse", board: "acme", enabled: true },
  { name: "Lever Demo", ats: "lever", board: "leverdemo", enabled: true },
];

describe("Greenhouse mapper", () => {
  it("maps a job, decoding entity-encoded HTML content", () => {
    const raw = mapGreenhouseJob(ghBoard.jobs[0]!, "Acme (GH)");
    expect(raw.source).toBe("company-careers");
    expect(raw.externalId).toBe("greenhouse:5364702001");
    expect(raw.title).toMatch(/Frontend Engineer/);
    expect(raw.company).toBe("Acme (GH)");
    expect(raw.location).toBe("Remote - India");
    expect(raw.description).toContain("React");
    expect(raw.description).not.toContain("&lt;"); // entities decoded
    expect(raw.description).not.toContain("<p>"); // tags stripped
    expect(raw.postedAt).toBeInstanceOf(Date);
    expect(raw.applicationUrl).toContain("greenhouse.io");
  });
});

describe("Lever mapper", () => {
  it("maps workplaceType, commitment and structured lists", () => {
    const raw = mapLeverPosting(leverBoard[0]!, "Lever Demo");
    expect(raw.externalId).toBe("lever:aaaa1111-2222-3333-4444-555566667777");
    expect(raw.remoteType).toBe("remote");
    expect(raw.employmentType).toBe("Full Time");
    expect(raw.responsibilities).toContain("Build UI components");
    expect((raw.requirements ?? []).join(" ")).toMatch(/React/);
    expect(raw.applicationUrl).toContain("/apply");
  });

  it("maps on-site workplaceType to onsite", () => {
    expect(mapLeverPosting(leverBoard[1]!, "Lever Demo").remoteType).toBe("onsite");
  });
});

describe("CompanyCareerAdapter", () => {
  const routes = () => [
    { match: /greenhouse\.io\/v1\/boards\/acme\/jobs/, payload: ghBoard },
    { match: /api\.lever\.co\/v0\/postings\/leverdemo/, payload: leverBoard },
  ];

  it("fetches both boards, maps, and filters by query relevance", async () => {
    const http = new FakeHttp(routes());
    const adapter = new CompanyCareerAdapter(true, {
      http,
      clients: [new GreenhouseClient(), new LeverClient()],
      loadCompanies: async () => companies,
    });
    const jobs = await adapter.searchJobs({ query: "React Developer" });
    const titles = jobs.map((j) => j.title);
    expect(titles.some((t) => /Frontend Engineer/.test(t))).toBe(true); // greenhouse frontend
    expect(titles.some((t) => /React Developer/.test(t))).toBe(true); // lever frontend
    expect(titles.some((t) => /Account Executive|Sales/.test(t))).toBe(false); // sales filtered out
  });

  it("memoizes each board across multiple searches (one fetch per board per run)", async () => {
    const http = new FakeHttp(routes());
    const adapter = new CompanyCareerAdapter(true, { http, loadCompanies: async () => companies });
    await adapter.searchJobs({ query: "React" });
    await adapter.searchJobs({ query: "Frontend" });
    await adapter.searchJobs({ query: "Engineer" });
    // 2 boards, fetched once each despite 3 searches.
    expect(http.calls.length).toBe(2);
  });

  it("isolates a failing company and still returns the others", async () => {
    const http = new FakeHttp([
      { match: /greenhouse\.io\/v1\/boards\/acme\/jobs/, payload: ghBoard, fail: 500 },
      { match: /api\.lever\.co\/v0\/postings\/leverdemo/, payload: leverBoard },
    ]);
    const adapter = new CompanyCareerAdapter(true, { http, loadCompanies: async () => companies });
    const jobs = await adapter.searchJobs({ query: "React" });
    expect(jobs.length).toBeGreaterThan(0); // lever still returned
    expect(jobs.every((j) => /lever/.test(j.externalId ?? ""))).toBe(true);
  });

  it("returns nothing when disabled", async () => {
    const http = new FakeHttp(routes());
    const adapter = new CompanyCareerAdapter(false, { http, loadCompanies: async () => companies });
    expect(await adapter.searchJobs({ query: "React" })).toEqual([]);
    expect(http.calls.length).toBe(0);
  });
});
