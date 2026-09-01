#!/usr/bin/env node
import { parseFlags } from "./cli/args.js";
import { runDaily } from "./cli/daily.js";
import { runMatch } from "./cli/match.js";
import { runSearch } from "./cli/search.js";
import { runStats } from "./cli/stats.js";
import { log } from "./utils/logger.js";

const COMMANDS = ["search", "match", "daily", "stats"] as const;
type Command = (typeof COMMANDS)[number];

function usage(): string {
  return [
    "Job Agent CLI",
    "",
    "Usage: tsx src/index.ts <command> [flags]",
    "",
    "Commands:",
    "  search   Discover + match jobs and print top results   (npm run jobs:search)",
    "  match    Discover + print the per-dimension score breakdown (npm run jobs:match)",
    "  daily    Full unattended run with notifications         (npm run jobs:daily)",
    "  stats    Show stored analytics and recent search runs   (npm run jobs:stats)",
    "",
    "Flags:",
    '  --query "React Developer"   Override the search queries',
    '  --location "Remote"          Override the search locations',
    "  --limit 20                   Cap results per query",
    "",
    "Example:",
    '  npm run jobs:search -- --query "React Developer" --location "Remote"',
  ].join("\n");
}

async function main(): Promise<void> {
  const [, , rawCommand, ...rest] = process.argv;
  const command = (rawCommand ?? "search") as Command;
  const flags = parseFlags(rest);

  const isKnown = COMMANDS.includes(command);
  if (rawCommand === "help" || flags.help || !isKnown) {
    process.stdout.write(usage() + "\n");
    process.exitCode = isKnown ? 0 : 1;
    return;
  }

  switch (command) {
    case "search":
      return runSearch(flags);
    case "match":
      return runMatch(flags);
    case "daily":
      return runDaily(flags);
    case "stats":
      return runStats(flags);
  }
}

main().catch((error: unknown) => {
  log("cli").error({ err: (error as Error).message, stack: (error as Error).stack }, "command failed");
  process.exitCode = 1;
});
