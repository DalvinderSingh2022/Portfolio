import { getEnv } from "../config/env.js";
import { loadSearchConfig } from "../config/searchConfig.js";
import type { SearchOverrides } from "../domain/search.js";
import { buildPipeline } from "../pipeline/JobPipeline.js";
import { buildSources } from "../sources/registry.js";
import { createStorage } from "../storage/prisma.js";
import { flagNumber, flagString, type parseFlags } from "./args.js";
import { formatDiscoveryHeader, formatTopMatches } from "./format.js";

/** `jobs:search` — run one discovery + matching pass and print the results. */
export async function runSearch(flags: ReturnType<typeof parseFlags>): Promise<void> {
  const env = getEnv();
  const config = await loadSearchConfig();
  const storage = await createStorage(env);

  const overrides: SearchOverrides = {
    query: flagString(flags, "query"),
    location: flagString(flags, "location"),
    limit: flagNumber(flags, "limit"),
  };

  try {
    const pipeline = await buildPipeline(storage, env);
    const summary = await pipeline.run(config, overrides);

    const allSources = buildSources(env).map((s) => s.name);
    process.stdout.write(formatDiscoveryHeader(summary, allSources) + "\n");
    process.stdout.write(formatTopMatches(summary.topMatches) + "\n");
    process.stdout.write(
      `Run ${summary.runId} completed in ${(summary.durationMs / 1000).toFixed(1)}s · storage: ${storage.backend}\n`,
    );
    if (storage.backend === "in-memory") {
      process.stdout.write("Note: in-memory storage — set DATABASE_URL to persist jobs across runs.\n");
    }
  } finally {
    await storage.close();
  }
}
