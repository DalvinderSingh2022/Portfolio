import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import type { JobSourceName } from "../domain/job.js";

loadDotenv();

const boolFromEnv = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : v.toLowerCase() === "true"));

const numFromEnv = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : Number(v)))
    .pipe(z.number());

const EnvSchema = z.object({
  DATABASE_URL: z.string().optional().transform((v) => (v === "" ? undefined : v)),

  LLM_PROVIDER: z.enum(["openai", "anthropic", "mock"]).default("mock"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  ENABLE_LLM_MATCHING: boolFromEnv(false),
  LLM_MAX_JOBS: numFromEnv(30),

  JOB_SEARCH_INTERVAL_HOURS: numFromEnv(6),
  MIN_MATCH_SCORE: numFromEnv(70),

  ENABLE_MOCK: boolFromEnv(true),
  ENABLE_LINKEDIN: boolFromEnv(false),
  ENABLE_INDEED: boolFromEnv(false),
  ENABLE_NAUKRI: boolFromEnv(false),
  ENABLE_WELLFOUND: boolFromEnv(false),
  ENABLE_GLASSDOOR: boolFromEnv(false),
  ENABLE_COMPANY_CAREERS: boolFromEnv(false),

  ENABLE_EMAIL_NOTIFICATIONS: boolFromEnv(false),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  NOTIFY_FROM: z.string().optional(),
  NOTIFY_TO: z.string().optional(),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOG_PRETTY: boolFromEnv(true),

  CANDIDATE_PROFILE_PATH: z.string().default("./data/candidate/profile.json"),
  CANDIDATE_RESUME_PATH: z.string().default("./data/candidate/resume.md"),
  SEARCH_CONFIG_PATH: z.string().default("./data/search/search.config.json"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Which sources are enabled, in priority order. */
export function enabledSources(env: Env = getEnv()): JobSourceName[] {
  const flags: Array<[JobSourceName, boolean]> = [
    ["mock", env.ENABLE_MOCK],
    ["linkedin", env.ENABLE_LINKEDIN],
    ["indeed", env.ENABLE_INDEED],
    ["naukri", env.ENABLE_NAUKRI],
    ["wellfound", env.ENABLE_WELLFOUND],
    ["glassdoor", env.ENABLE_GLASSDOOR],
    ["company-careers", env.ENABLE_COMPANY_CAREERS],
  ];
  return flags.filter(([, on]) => on).map(([name]) => name);
}
