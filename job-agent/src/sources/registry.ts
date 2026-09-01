import { getEnv, type Env } from "../config/env.js";
import type { JobSourceName } from "../domain/job.js";
import { CompanyCareerAdapter } from "./company-careers/CompanyCareerAdapter.js";
import { GlassdoorAdapter } from "./glassdoor/GlassdoorAdapter.js";
import { IndeedAdapter } from "./indeed/IndeedAdapter.js";
import type { JobSource } from "./JobSource.js";
import { LinkedInAdapter } from "./linkedin/LinkedInAdapter.js";
import { MockJobSource } from "./mock/MockJobSource.js";
import { NaukriAdapter } from "./naukri/NaukriAdapter.js";
import { WellfoundAdapter } from "./wellfound/WellfoundAdapter.js";

/**
 * Build the full set of adapters, each carrying its enabled/disabled flag from
 * env. The registry is the ONLY place that knows the concrete adapter classes;
 * everything downstream depends on the `JobSource` interface.
 */
export function buildSources(env: Env = getEnv()): JobSource[] {
  return [
    new MockJobSource(),
    new LinkedInAdapter(env.ENABLE_LINKEDIN),
    new IndeedAdapter(env.ENABLE_INDEED),
    new NaukriAdapter(env.ENABLE_NAUKRI),
    new WellfoundAdapter(env.ENABLE_WELLFOUND),
    new GlassdoorAdapter(env.ENABLE_GLASSDOOR),
    new CompanyCareerAdapter(env.ENABLE_COMPANY_CAREERS),
  ].map((source) =>
    // Mock's own `enabled` is fixed true; respect the env toggle for it too.
    source.name === "mock" ? withEnabled(source, env.ENABLE_MOCK) : source,
  );
}

/** Return only the sources that are enabled. */
export function activeSources(env: Env = getEnv()): JobSource[] {
  return buildSources(env).filter((s) => s.enabled);
}

function withEnabled(source: JobSource, enabled: boolean): JobSource {
  // MockJobSource declares `enabled` readonly true; wrap to honor the env flag
  // without mutating the instance.
  if (source.enabled === enabled) return source;
  return new Proxy(source, {
    get(target, prop, receiver) {
      if (prop === "enabled") return enabled;
      return Reflect.get(target, prop, receiver);
    },
  }) as JobSource;
}

export function isKnownSource(name: string): name is JobSourceName {
  return [
    "mock",
    "linkedin",
    "indeed",
    "naukri",
    "wellfound",
    "glassdoor",
    "company-careers",
  ].includes(name);
}
