import type { MergedJob } from "../domain/job.js";
import { normalizeText } from "../utils/text.js";

/**
 * A vocabulary of skills we can detect in free text. Extend freely — it is data,
 * not logic. Multi-word entries are matched as substrings of normalized text.
 */
export const SKILL_VOCABULARY: string[] = [
  "javascript", "typescript", "react", "next.js", "redux", "react native",
  "node.js", "express", "nest.js", "graphql", "rest apis", "html", "css",
  "tailwind css", "mongodb", "postgresql", "mysql", "sql", "prisma", "redis",
  "git", "docker", "kubernetes", "aws", "gcp", "azure", "terraform", "ci/cd",
  "python", "java", "go", "vue", "angular", "svelte", "jest", "vitest",
  "playwright", "cypress", "accessibility", "webpack", "vite",
];

/**
 * Fills in structured data that sources leave blank — most importantly, skills
 * inferred from the description/requirements when the source did not tag them.
 * Enrichment is additive and never removes source-provided data.
 */
export class JobEnricher {
  constructor(private readonly vocabulary: string[] = SKILL_VOCABULARY) {}

  enrich(job: MergedJob): MergedJob {
    const haystack = normalizeText(
      [job.title, job.description, job.requirements.join(" "), job.responsibilities.join(" ")].join(" "),
    );
    const existing = new Set(job.skills.map((s) => normalizeText(s)));
    const discovered: string[] = [];
    for (const skill of this.vocabulary) {
      const norm = normalizeText(skill);
      if (existing.has(norm)) continue;
      if (this.mentions(haystack, norm)) discovered.push(skill);
    }
    if (discovered.length === 0) return job;
    return { ...job, skills: [...job.skills, ...discovered] };
  }

  enrichAll(jobs: MergedJob[]): MergedJob[] {
    return jobs.map((j) => this.enrich(j));
  }

  private mentions(haystack: string, skill: string): boolean {
    // Word-boundary-ish match for single tokens; substring for multi-word skills.
    if (skill.includes(" ")) return haystack.includes(skill);
    const re = new RegExp(`(^|\\s)${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
    return re.test(haystack);
  }
}
