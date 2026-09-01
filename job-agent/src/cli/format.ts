import type { MatchedJob } from "../domain/matching.js";
import type { PipelineSummary } from "../pipeline/JobPipeline.js";

const check = "✓";

export function relativeTime(date: Date | undefined): string {
  if (!date) return "unknown date";
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDiscoveryHeader(summary: PipelineSummary, allSources: string[]): string {
  const lines: string[] = ["", "Job Discovery", "", "Sources:"];
  for (const name of allSources) {
    const used = summary.sources.includes(name);
    const failed = summary.errors.some((e) => e.source === name);
    const mark = failed ? "✗" : used ? check : "·";
    lines.push(`${mark} ${prettySource(name)}${failed ? " (failed)" : used ? "" : " (disabled)"}`);
  }
  lines.push(
    "",
    `Found:        ${summary.found}`,
    `Duplicates:   ${summary.duplicates}`,
    `Filtered:     ${summary.filtered}`,
    `New jobs:     ${summary.newJobs}`,
    `Highly match: ${summary.highMatches}`,
  );
  if (summary.errors.length) {
    lines.push("", "Source errors:");
    for (const e of summary.errors) lines.push(`  ✗ ${e.source}: ${e.message}`);
  }
  return lines.join("\n");
}

export function formatTopMatches(matches: MatchedJob[], limit = 10): string {
  if (matches.length === 0) return "\nNo matches above the reporting bar.\n";
  const lines: string[] = ["", "Top Matches", ""];
  matches.slice(0, limit).forEach(({ job, match }, i) => {
    const skills = match.details.matchedSkills.slice(0, 4).join(", ") || "-";
    lines.push(`${i + 1}. ${job.title}`);
    lines.push(`   Company: ${job.company}`);
    lines.push(`   Location: ${job.location ?? job.remoteType}`);
    lines.push(`   Match: ${match.finalScore}% (${match.recommendation.replace("_", " ")})`);
    lines.push(`   Skills: ${skills}`);
    lines.push(`   Sources: ${job.sources.join(", ")}`);
    lines.push(`   Posted: ${relativeTime(job.postedAt)}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function formatBreakdown(matched: MatchedJob): string {
  const { job, match } = matched;
  const dims = Object.entries(match.scores)
    .map(([k, v]) => `     ${k.padEnd(12)} ${String(v).padStart(3)}  (weight ${(match.weights[k as keyof typeof match.weights] * 100).toFixed(0)}%)`)
    .join("\n");
  const flags = match.details.hardRejectReasons.length
    ? `\n     rejected: ${match.details.hardRejectReasons.join("; ")}`
    : "";
  return [
    `- ${job.title} @ ${job.company}  ->  ${match.finalScore}% (${match.recommendation})`,
    dims,
    flags,
  ].filter(Boolean).join("\n");
}

export function prettySource(name: string): string {
  const map: Record<string, string> = {
    mock: "Mock",
    linkedin: "LinkedIn",
    indeed: "Indeed",
    naukri: "Naukri",
    wellfound: "Wellfound",
    glassdoor: "Glassdoor",
    "company-careers": "Company Careers",
  };
  return map[name] ?? name;
}
