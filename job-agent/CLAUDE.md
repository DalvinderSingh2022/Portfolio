# CLAUDE.md — Job Discovery & Matching Agent

Guidance for AI assistants (and humans) working in this package.

## What this is

A modular agent that **discovers** software-development jobs from multiple
platforms, **normalizes** them to a common model, **deduplicates** across
sources, **matches** them against a candidate profile, **scores/ranks** them,
**filters** low-quality/irrelevant postings, and surfaces the best via CLI /
notifications. It does **not** auto-apply to jobs (out of scope by design).

Phase 1 (this codebase) is fully working on a deterministic **mock source** with
an **in-memory** store, so it runs with zero credentials and no database.

## Architecture (the important part)

Everything flows through one seam — the `JobSource` interface — so the matching,
scoring, storage and recommendation layers never know which platform a job came
from.

```
Sources (adapters)                Pipeline stages
  mock ─┐                         discover → normalize → validate → dedupe →
  linkedin ─┤  JobSource[]  ──▶   enrich → rule-filter → LLM-match(capped) →
  indeed ─┤                       score → rank → persist → notify
  …     ─┘
```

Key modules:

| Path | Responsibility |
| --- | --- |
| `src/sources/JobSource.ts` | The adapter interface every platform implements. |
| `src/sources/registry.ts` | The ONLY place that knows concrete adapter classes. |
| `src/sources/company-careers/` | **Live** ATS integration: `GreenhouseClient` + `LeverClient` (pure mappers), injectable `HttpJsonClient`, per-company config. |
| `src/discovery/JobNormalizer.ts` | RawJob → strict `Job` + deterministic fingerprint. |
| `src/discovery/JobDeduplicator.ts` | Union-find merge across sources; preserves all sources. |
| `src/discovery/JobEnricher.ts` | Fills skills inferred from text. |
| `src/discovery/JobDiscoveryService.ts` | Fan-out with **failure isolation**. |
| `src/matching/RuleBasedMatcher.ts` | Cheap, explainable per-dimension scoring + hard rejects. |
| `src/matching/LLMMatcher.ts` | Optional AI stage; parse → Zod → business validation → cache. |
| `src/matching/ScoringService.ts` | Transparent weighted score → recommendation band. |
| `src/matching/JobMatchingService.ts` | Orchestrates rule → (capped) LLM → score → rank. |
| `src/storage/repositories/*` | `Storage` interface with **InMemory** and **Prisma** impls. |
| `src/pipeline/JobPipeline.ts` | Composition root + `buildPipeline()`. |
| `src/api/DashboardService.ts` | Framework-agnostic query facade for the future HTTP API. |
| `src/cli/*` | `search`, `match`, `daily`, `stats` commands. |

## Non-negotiable rules encoded in the matcher

- **Never** reject a job solely for missing a *preferred*/nice-to-have skill.
- **Never** assume a job is expired just because a posting date is missing.
- Distinguish required vs preferred vs nice-to-have skills.
- The LLM must **never** invent candidate experience (enforced in the prompt).
- Raw LLM output is **never** trusted: JSON parse → Zod → business checks.

## Configuration, not hardcoding

Candidate data, search config, weights and toggles are all external:
`data/candidate/profile.json`, `data/candidate/resume.md`,
`data/search/search.config.json`, and env vars (`.env`, see `.env.example`).
Do not scatter these values through the code.

## Compliance stance (read before "improving" a source)

The **company-careers** source IS wired, via the **public** Greenhouse
`boards-api` and Lever `postings-api` — documented, auth-free JSON endpoints
intended for programmatic use. That is the model to follow: fetch a permitted
API, map to `RawJob`, rate-limit, isolate failures.

The remaining platform adapters (LinkedIn, Indeed, Naukri, Wellfound, Glassdoor)
are **disabled by default** and do **not** scrape. Where a platform's ToS forbids
automated access or gates it behind auth/anti-bot, the adapter stays disabled and
throws `SourceNotImplementedError` if enabled without a permitted integration.
Permitted paths: official/partner APIs, approved feeds, public ATS boards, or
user-provided exports. Never add code that bypasses authentication, rate limits,
or CAPTCHAs.

### ATS integration shape (reference for the next source)

`src/sources/company-careers/` shows the pattern:
- `ats/HttpClient.ts` — injectable `HttpJsonClient` (fetch + timeout + retry), so
  clients unit-test against fixtures, not the network.
- `ats/greenhouse.ts`, `ats/lever.ts` — an `AtsClient` (fetch a board) plus a
  **pure** `map*` function (payload → `RawJob`), exported for tests.
- `companies.ts` + `data/sources/companies.json` — per-company board config.
- `CompanyCareerAdapter` — loads companies, dispatches to the right client,
  memoizes each board once per run, filters by query relevance, isolates
  per-company failures. Network-free tests live in `tests/sources/companyCareers.test.ts`
  (fixtures in `tests/fixtures/`).

## How to add a new job source

1. Add the name to `JOB_SOURCE_NAMES` in `src/domain/job.ts`.
2. Create `src/sources/<name>/<Name>Adapter.ts`:
   - For a real platform, `extends BaseAdapter` and override `doSearch()` with a
     **permitted** integration; keep the class disabled until it's wired.
   - Map the platform's payload to `RawJob` (loose shape — the normalizer cleans it).
3. Register it in `src/sources/registry.ts` (`buildSources`) with its env flag.
4. Add an `ENABLE_<NAME>` flag to `src/config/env.ts` and `.env.example`.
5. Add a fixture-based test under `tests/sources/`.
6. Nothing else changes — normalization, dedup, matching, scoring, storage and the
   dashboard all work automatically because they depend only on `JobSource`/`Job`.

See `src/sources/mock/MockJobSource.ts` for a complete working reference adapter.

## Dev workflow

```bash
npm install
npm run db:generate     # generate Prisma client (no DB needed)
npm run typecheck
npm test
npm run jobs:search     # runs on mock data, in-memory store
```

Prisma/PostgreSQL is optional in Phase 1 — set `DATABASE_URL` and run
`npm run db:migrate` to persist across runs; otherwise the in-memory store is used.

## Gotchas

- ESM project (`"type": "module"`): intra-repo imports use the **`.js`** extension.
- `noUncheckedIndexedAccess` is on — index access is `T | undefined`.
- Logs are redacted (passwords/cookies/tokens/secrets) via Pino `redact`. Never
  log credentials.
- `tsx` runs TS directly for the CLI; `tsc` is used for typecheck/build.
