import type { MatchedJob } from "../domain/matching.js";

export interface Notifier {
  readonly channel: "console" | "email";
  readonly enabled: boolean;
  send(matched: MatchedJob): Promise<void>;
}

/** Shared human-readable rendering of a high-match alert. */
export function formatAlert(matched: MatchedJob): string {
  const { job, match } = matched;
  const matchedSkills = match.details.matchedSkills;
  const missing = match.details.missingSkills;
  const lines = [
    "New high-match job found",
    "",
    `${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location ?? job.remoteType}`,
    `Match: ${match.finalScore}% (${match.recommendation.replace("_", " ")})`,
    "",
    "Top matches:",
    ...(matchedSkills.length ? matchedSkills.map((s) => `  ✓ ${s}`) : ["  (none)"]),
  ];
  if (missing.length) {
    lines.push("", "Missing:", ...missing.slice(0, 5).map((s) => `  - ${s}`));
  }
  lines.push("", "Apply:", `  ${job.applicationUrl}`);
  return lines.join("\n");
}
