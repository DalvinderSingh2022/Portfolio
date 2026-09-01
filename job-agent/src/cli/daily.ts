import { getEnv } from "../config/env.js";
import { loadSearchConfig } from "../config/searchConfig.js";
import { buildPipeline } from "../pipeline/JobPipeline.js";
import { buildSources } from "../sources/registry.js";
import { createStorage } from "../storage/prisma.js";
import { log } from "../utils/logger.js";
import type { parseFlags } from "./args.js";
import { formatDiscoveryHeader, formatTopMatches } from "./format.js";

/**
 * `jobs:daily` — the unattended run intended for scheduling (see README for the
 * cron/interval setup). Runs the full pipeline and notifies on high matches.
 */
export async function runDaily(_flags: ReturnType<typeof parseFlags>): Promise<void> {
  const env = getEnv();
  const logger = log("daily");
  const config = await loadSearchConfig();
  const storage = await createStorage(env);
  try {
    const pipeline = await buildPipeline(storage, env);
    const summary = await pipeline.run(config);
    process.stdout.write(formatDiscoveryHeader(summary, buildSources(env).map((s) => s.name)) + "\n");
    process.stdout.write(formatTopMatches(summary.topMatches, 5) + "\n");
    logger.info(
      { newJobs: summary.newJobs, highMatches: summary.highMatches, notified: summary.notificationsSent },
      "daily run complete",
    );
  } finally {
    await storage.close();
  }
}
