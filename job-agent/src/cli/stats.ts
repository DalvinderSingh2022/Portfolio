import { getEnv } from "../config/env.js";
import { createStorage } from "../storage/prisma.js";
import { relativeTime } from "./format.js";
import type { parseFlags } from "./args.js";

/** `jobs:stats` — print stored analytics and recent search runs. */
export async function runStats(_flags: ReturnType<typeof parseFlags>): Promise<void> {
  const env = getEnv();
  const storage = await createStorage(env);
  try {
    const stats = await storage.stats(env.MIN_MATCH_SCORE);
    const runs = await storage.searchRuns.list(5);

    const lines: string[] = ["", "Job Agent Stats", "", `Storage: ${storage.backend}`, ""];
    lines.push(`Total jobs:   ${stats.totalJobs}`);
    lines.push(`Active jobs:  ${stats.activeJobs}`);
    lines.push(`High matches: ${stats.highMatches} (>= ${env.MIN_MATCH_SCORE}%)`);
    lines.push("", "By source:");
    for (const [k, v] of Object.entries(stats.bySource)) lines.push(`  ${k.padEnd(16)} ${v}`);
    lines.push("", "By recommendation:");
    for (const [k, v] of Object.entries(stats.byRecommendation)) lines.push(`  ${k.padEnd(16)} ${v}`);
    lines.push("", "By application status:");
    for (const [k, v] of Object.entries(stats.byApplicationStatus)) lines.push(`  ${k.padEnd(16)} ${v}`);

    lines.push("", "Recent search runs:");
    if (runs.length === 0) lines.push("  (none yet)");
    for (const r of runs) {
      lines.push(
        `  ${relativeTime(r.startedAt)}: found ${r.jobsFound}, new ${r.jobsNew}, ` +
          `dupes ${r.jobsDuplicate}, filtered ${r.jobsRejected}, shortlisted ${r.jobsShortlisted}` +
          (r.errors.length ? `, errors ${r.errors.length}` : ""),
      );
    }

    if (storage.backend === "in-memory") {
      lines.push(
        "",
        "Note: in-memory storage does not persist between processes.",
        "Set DATABASE_URL and run `npm run db:migrate` to keep history across runs.",
      );
    }
    process.stdout.write(lines.join("\n") + "\n");
  } finally {
    await storage.close();
  }
}
