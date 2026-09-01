import { z } from "zod";
import { JOB_SOURCE_NAMES } from "./job.js";

/**
 * Criteria handed to an individual JobSource adapter for one search.
 */
export const JobSearchCriteriaSchema = z.object({
  query: z.string().min(1),
  location: z.string().optional(),
  experience: z
    .object({
      minYears: z.number().nonnegative().optional(),
      maxYears: z.number().nonnegative().optional(),
    })
    .optional(),
  jobTypes: z.array(z.string()).optional(),
  /** Soft cap on how many results the adapter should return. */
  limit: z.number().int().positive().optional(),
});
export type JobSearchCriteria = z.infer<typeof JobSearchCriteriaSchema>;

const PerSourceOverrideSchema = z.object({
  queries: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
});

/**
 * The whole search configuration loaded from `data/search/search.config.json`.
 * `perSource` lets a platform run a narrower set of queries/locations than the
 * global default (e.g. LinkedIn only for two high-signal queries).
 */
export const SearchConfigSchema = z.object({
  queries: z.array(z.string().min(1)).min(1),
  locations: z.array(z.string().min(1)).default([]),
  experience: z
    .object({
      minYears: z.number().nonnegative().default(0),
      maxYears: z.number().nonnegative().default(99),
    })
    .default({ minYears: 0, maxYears: 99 }),
  jobTypes: z.array(z.string()).default([]),
  resultsPerQuery: z.number().int().positive().default(25),
  perSource: z
    .record(z.enum(JOB_SOURCE_NAMES), PerSourceOverrideSchema)
    .default({}),
});
export type SearchConfig = z.infer<typeof SearchConfigSchema>;

/** Overrides supplied on the CLI, e.g. `--query "React Developer"`. */
export interface SearchOverrides {
  query?: string;
  location?: string;
  limit?: number;
}

/**
 * Expand a SearchConfig into the concrete per-source list of criteria to run.
 */
export function buildCriteria(
  config: SearchConfig,
  source: string,
  overrides: SearchOverrides = {},
): JobSearchCriteria[] {
  const perSource = (config.perSource as Record<string, { queries?: string[]; locations?: string[] }>)[source];
  const queries = overrides.query
    ? [overrides.query]
    : perSource?.queries ?? config.queries;
  const locations = overrides.location
    ? [overrides.location]
    : perSource?.locations ?? (config.locations.length > 0 ? config.locations : [undefined]);

  const criteria: JobSearchCriteria[] = [];
  for (const query of queries) {
    for (const location of locations) {
      criteria.push({
        query,
        location: location ?? undefined,
        experience: config.experience,
        jobTypes: config.jobTypes,
        limit: overrides.limit ?? config.resultsPerQuery,
      });
    }
  }
  return criteria;
}
