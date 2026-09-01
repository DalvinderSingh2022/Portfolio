# Job Discovery & Matching Agent

A modular, production-oriented agent that finds relevant software-development
jobs across multiple platforms, normalizes them, removes duplicates, matches
them against your profile, scores/ranks them, filters out noise, and surfaces
the best opportunities via CLI and notifications.

> **Scope:** discovery, matching and ranking only. It does **not** submit job
> applications — that's intentionally out of scope for this phase.

Phase 1 is **fully working today** on a deterministic mock source with an
in-memory store, so you can run the whole pipeline with **no API keys and no
database**. **Phase 2 is now wired**: a real, permitted **company-careers**
source pulls live jobs from public **Greenhouse** and **Lever** ATS boards. Both
plugged in without touching the matching, scoring, storage or recommendation code.

## Quick start

```bash
npm install
npm run db:generate      # generate the Prisma client (no database required)
npm run jobs:search      # run discovery + matching on mock data
```

That's it — you'll see a discovery summary and ranked top matches. To persist
data across runs, configure PostgreSQL (below) and run `npm run db:migrate`.

The exact acceptance flow from the spec also works:

```bash
npm install
npm run db:migrate       # requires a reachable DATABASE_URL (see below)
npm run jobs:search
```

If `DATABASE_URL` is empty, the agent automatically uses an **in-memory** store
so `jobs:search` still produces a complete pipeline run.

## Commands

| Command | What it does |
| --- | --- |
| `npm run jobs:search` | One discovery + matching pass; prints the summary and top matches. |
| `npm run jobs:match` | Discovers, then prints the **transparent per-dimension score breakdown**. |
| `npm run jobs:daily` | Full unattended run (for scheduling); notifies on high matches. |
| `npm run jobs:stats` | Stored analytics + recent search runs. |
| `npm run typecheck` / `npm test` / `npm run build` | TS check / Vitest / compile. |

Flags (search/match):

```bash
npm run jobs:search -- --query "React Developer" --location "Remote" --limit 20
```

### Example output

```
Job Discovery

Sources:
✓ Mock
· LinkedIn (disabled)
· Indeed (disabled)
…

Found:        375
Duplicates:   361
Filtered:     6
New jobs:     14
Highly match: 6

Top Matches

1. Frontend Engineer
   Company: Example Startup
   Location: Bangalore, India
   Match: 99% (highly relevant)
   Skills: react, typescript, node js, javascript
   Sources: mock
   Posted: 1 day ago
…
```

## Configuration

Copy `.env.example` to `.env` and adjust. Nothing sensitive is required for the
mock pipeline. Key settings:

- `DATABASE_URL` — PostgreSQL connection; empty ⇒ in-memory store.
- `MIN_MATCH_SCORE` — notification/shortlist threshold (default 70).
- `ENABLE_<SOURCE>` — per-source toggles (all real sources off by default).
- `ENABLE_LLM_MATCHING` / `LLM_PROVIDER` — AI stage (off by default; `mock`
  provider runs offline and deterministically).
- `LLM_MAX_JOBS` — cost cap on how many jobs reach the LLM per run.
- `LOG_LEVEL`, `LOG_PRETTY` — structured logging (secrets are auto-redacted).

Your profile and searches live in editable data files (not hardcoded):

- `data/candidate/profile.json` — skills, preferred roles/locations, experience,
  employment types, minimum match score.
- `data/candidate/resume.md` — resume text (used by the optional LLM matcher).
- `data/search/search.config.json` — queries, locations, experience band, job
  types, and optional per-source overrides.

## How matching & scoring work

Two-stage matching keeps LLM cost down:

1. **Rule-based** (cheap, deterministic, explainable): scores seven dimensions —
   role, skills, experience, location, employment, salary, freshness — and hard-
   rejects spam/expired/insufficient/senior-mismatch/unavailable-location jobs.
2. **AI matching** (optional): only the top survivors of stage 1 (capped by
   `LLM_MAX_JOBS`) go to the LLM; results are cached by
   `job fingerprint + profile version` so the same job/profile is never re-sent.

**Transparent weighted score** (weights configurable in
`src/matching/ScoringService.ts`):

| Dimension | Weight |
| --- | --- |
| Skills | 30% |
| Role | 25% |
| Experience | 20% |
| Location | 10% |
| Employment | 5% |
| Salary | 5% |
| Freshness | 5% |

Bands: `0–49 reject · 50–64 weak · 65–74 possible · 75–84 relevant · 85–100 highly relevant`.
Every individual dimension score is stored, not just the final number.

Guardrails: a missing *preferred* skill never causes rejection; a missing posting
date never implies "expired"; the LLM is instructed never to invent experience,
and its output is validated (JSON → Zod → business checks) before use.

## Deduplication

The same position often appears on several platforms. A deterministic
fingerprint (`company + normalized_title + normalized_location`) plus signals
(canonical URL, external id, title/description similarity within a company)
cluster duplicates via union-find. Duplicates are **merged, not deleted** — every
source that saw the job is preserved on the record.

## PostgreSQL / Prisma (optional, for persistence)

```bash
# 1. Start Postgres and create a database, then set DATABASE_URL in .env, e.g.:
#    DATABASE_URL="postgresql://user:pass@localhost:5432/job_agent?schema=public"
npm run db:migrate       # create tables
npm run jobs:search      # now persists jobs, matches, search runs, notifications
npm run jobs:stats       # history/analytics across runs
```

Models: `CandidateProfile`, `Job`, `JobSourceSighting`, `JobSkill`, `JobMatch`,
`SearchRun`, `Notification` (see `prisma/schema.prisma`). Jobs track
`firstSeenAt`, `lastSeenAt`, `active`, `matchScore`, `recommendation` and an
`applicationStatus` lifecycle (`discovered → reviewing → shortlisted → rejected →
applied → interview → offer → closed`).

## Live source: company career pages (Greenhouse + Lever)

The `company-careers` source is a **real, permitted integration** over the public
ATS APIs — Greenhouse `boards-api` and Lever `postings-api`. These are documented,
auth-free JSON endpoints intended for programmatic access (no scraping, no
credentials).

Enable it and point it at the companies you care about:

```bash
# .env
ENABLE_COMPANY_CAREERS=true
```

```jsonc
// data/sources/companies.json
{
  "companies": [
    { "name": "GitLab", "ats": "greenhouse", "board": "gitlab", "enabled": true },
    { "name": "Figma",  "ats": "greenhouse", "board": "figma",  "enabled": true },
    { "name": "Some Co","ats": "lever",      "board": "someco", "enabled": true }
  ]
}
```

The `board` is the token in the ATS URL — `boards.greenhouse.io/<board>` or
`jobs.lever.co/<board>`. Then:

```bash
ENABLE_MOCK=false ENABLE_COMPANY_CAREERS=true npm run jobs:search -- --query "Frontend Engineer"
```

Each board is fetched at most **once per run** (memoized) and reused across every
query/location, with rate limiting, timeouts and retry/backoff. A single company
failing is isolated — the rest of the run continues. Descriptions are extracted
from the ATS payloads (Greenhouse HTML is decoded to text; Lever's structured
`lists` become requirements/responsibilities), then the shared enricher infers
skills, and the normal matching/scoring/dedup/ranking applies unchanged.

## Adding another job source

Adapters are the only thing you write to add a platform — see the step-by-step
guide in [CLAUDE.md](CLAUDE.md#how-to-add-a-new-job-source), the ATS reference
implementation in `src/sources/company-careers/`, and the mock reference in
`src/sources/mock/MockJobSource.ts`.

**Compliance:** the remaining platform adapters (LinkedIn, Indeed, Naukri,
Wellfound, Glassdoor) are disabled by default and do **not** scrape. Wire only
permitted integrations — official/partner APIs, approved feeds, public ATS
boards, or user-provided exports. The system never bypasses authentication,
rate limits, or CAPTCHAs.

## Dashboard API (prepared for Phase 4)

`src/api/DashboardService.ts` is a framework-agnostic query facade that a thin
Express/Fastify layer can map 1:1 onto:
`GET /api/jobs`, `/api/jobs/:id`, `/api/jobs/recommended`,
`/api/jobs/search-runs`, `/api/jobs/stats`, `/api/profile`, with filters for
source, score, location, remote, company, skills, postedSince, employmentType,
and status.

## Scheduling

Run `npm run jobs:daily` on a schedule (default cadence
`JOB_SEARCH_INTERVAL_HOURS=6`). Use cron or any scheduler, e.g.:

```cron
0 */6 * * *  cd /path/to/job-agent && /usr/bin/npm run jobs:daily >> agent.log 2>&1
```

Adapters apply rate limiting, retries, exponential backoff and request timeouts
to stay polite to job platforms.

## Project layout

```
src/
  config/        env + search-config loaders (Zod-validated)
  domain/        Job, Candidate, Search, Matching models + schemas
  sources/       JobSource interface, registry, mock + platform adapters
  discovery/     normalize, validate, dedupe, enrich, discovery service
  matching/      rule matcher, LLM matcher, scoring, prompts/
  candidate/     profile/resume/preferences loaders
  storage/       Storage interface + InMemory & Prisma implementations
  pipeline/      JobPipeline composition root
  notifications/ Console + Email notifiers, NotificationService
  api/           DashboardService (query facade for the future HTTP API)
  cli/           search / match / daily / stats commands
tests/           matching, discovery, deduplication, sources, pipeline
data/            candidate profile + resume, search config
prisma/          schema.prisma
```

## Testing

```bash
npm test
```

Covers matching (strong/weak/missing-skill/overqualified/remote/location/spam/
freshness), deduplication (cross-platform, URL variants, description similarity,
distinct jobs), scoring (deterministic, bands, custom weights, LLM blend),
normalization, source **failure isolation**, and the full pipeline
(source → normalize → dedupe → match → save).

## Notes

- ESM + strict TypeScript; the CLI runs via `tsx`.
- `npm audit` reports advisories in **dev-only** tooling (esbuild via
  vitest/vite); these are not part of the shipped CLI. Avoid `npm audit fix
  --force`, which downgrades the test toolchain.
- Roadmap: **Phase 2 done** for company-careers (Greenhouse + Lever); remaining
  platform integrations (LinkedIn/Indeed/Naukri/Wellfound/Glassdoor) await
  permitted APIs · Phase 3 AI matching + notifications wiring · Phase 4 dashboard
  HTTP API + analytics + scheduling · Phase 5 (separate) application workflow.
