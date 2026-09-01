import type { CandidatePreferences } from "../candidate/preferences.js";
import type { MergedJob } from "../domain/job.js";
import type { DimensionScores, RuleMatchDetails, RuleMatchResult } from "../domain/matching.js";
import { normalizeText, normalizeTitle } from "../utils/text.js";

const SENIORITY_MARKERS = ["senior", "sr", "staff", "principal", "lead", "architect", "head", "vp"];
const SPAM_PATTERNS = [
  /\bno experience needed\b/i,
  /\bregistration fee\b/i,
  /\bearn\s*\$?\d+[k]?\s*(\/|per)?\s*(week|day|hour)\b/i,
  /!!!+/,
  /\bwork from home\b.*\b(no skills|no experience)\b/i,
  /\bquick cash\b/i,
];
const EXPIRED_PATTERNS = [
  /position (has been )?(filled|closed)/i,
  /no longer accepting/i,
  /\bclosed\b.*\bapplications?\b/i,
];

/**
 * Deterministic, explainable first-pass matcher. Produces per-dimension scores
 * (0..100) plus a details object, and flags hard rejections so obviously
 * irrelevant/low-quality jobs never reach the (paid) LLM stage.
 *
 * Guardrails from the spec:
 *  - Never reject a job solely for missing a preferred/nice-to-have skill.
 *  - Never assume a job is expired just because a posting date is missing.
 *  - Distinguish required vs preferred vs nice-to-have skills.
 */
export class RuleBasedMatcher {
  match(job: MergedJob, prefs: CandidatePreferences): RuleMatchResult {
    const details = this.emptyDetails(prefs.experienceYears);
    const hardReject = new Set<string>();
    const warnings: string[] = [];

    // --- Skills -----------------------------------------------------------
    const jobSkills = new Set(job.skills.map((s) => normalizeText(s)));
    for (const skill of jobSkills) {
      if (prefs.skills.has(skill)) details.matchedSkills.push(skill);
      else if (prefs.relatedSkills.has(skill)) details.relatedSkills.push(skill);
      else details.missingSkills.push(skill);
    }
    const skillsScore = this.scoreSkills(jobSkills.size, details);

    // --- Role -------------------------------------------------------------
    const { roleScore, matchedRole } = this.scoreRole(job, prefs);
    details.matchedRole = matchedRole;

    // --- Experience -------------------------------------------------------
    const required = this.parseExperience(job.experienceRequired, job.description);
    details.experienceRequired = required;
    const experienceScore = this.scoreExperience(prefs.experienceYears, required, hardReject, job);

    // --- Location ---------------------------------------------------------
    const { locationScore, locationMatch } = this.scoreLocation(job, prefs, hardReject);
    details.locationMatch = locationMatch;

    // --- Employment -------------------------------------------------------
    const { employmentScore, employmentMatch } = this.scoreEmployment(job, prefs);
    details.employmentMatch = employmentMatch;

    // --- Salary -----------------------------------------------------------
    const salaryScore = this.scoreSalary(job, prefs);

    // --- Freshness --------------------------------------------------------
    const freshnessScore = this.scoreFreshness(job.postedAt);

    // --- Quality / hard rejections ---------------------------------------
    this.applyQualityRules(job, roleScore, skillsScore, details, hardReject, warnings);

    details.hardRejectReasons = [...hardReject];
    details.warnings = warnings;

    const scores: DimensionScores = {
      role: roleScore,
      skills: skillsScore,
      experience: experienceScore,
      location: locationScore,
      employment: employmentScore,
      salary: salaryScore,
      freshness: freshnessScore,
    };

    return { scores, details, rejected: hardReject.size > 0 };
  }

  // ---- dimension scorers ------------------------------------------------

  private scoreSkills(jobSkillCount: number, details: RuleMatchDetails): number {
    if (jobSkillCount === 0) return 50; // unknown skills — neutral, not a penalty
    const credit = details.matchedSkills.length + 0.5 * details.relatedSkills.length;
    return clamp(Math.round((100 * credit) / jobSkillCount));
  }

  private scoreRole(job: MergedJob, prefs: CandidatePreferences): { roleScore: number; matchedRole?: string } {
    const titleTokens = new Set(normalizeTitle(job.title).split(" ").filter(Boolean));
    let best = 0;
    let matchedRole: string | undefined;
    prefs.preferredRoleTokens.forEach((roleTokens, idx) => {
      const meaningful = roleTokens.filter((t) => !["developer", "engineer"].includes(t) || roleTokens.length === 1);
      const overlap = roleTokens.filter((t) => titleTokens.has(t)).length / Math.max(1, roleTokens.length);
      // Bonus when a distinctive token (react/frontend/full stack) matches.
      const distinctiveHit = meaningful.some((t) => titleTokens.has(t)) ? 0.15 : 0;
      const score = Math.min(1, overlap + distinctiveHit);
      if (score > best) {
        best = score;
        matchedRole = prefs.preferredRolesRaw[idx];
      }
    });
    return { roleScore: clamp(Math.round(best * 100)), matchedRole: best > 0 ? matchedRole : undefined };
  }

  private scoreExperience(
    candidateYears: number,
    required: { min?: number; max?: number } | undefined,
    hardReject: Set<string>,
    job: MergedJob,
  ): number {
    if (!required || (required.min === undefined && required.max === undefined)) return 80; // unknown — don't penalize
    const min = required.min ?? 0;
    const max = required.max ?? Infinity;
    if (candidateYears >= min && candidateYears <= max) return 100;
    if (candidateYears < min) {
      const gap = min - candidateYears;
      const senior = SENIORITY_MARKERS.some((m) => normalizeTitle(job.title).split(" ").includes(m));
      if (gap >= 5 || (senior && gap >= 3)) {
        hardReject.add(`requires significantly more experience (needs ${min}+ yrs, have ${candidateYears})`);
      }
      return clamp(Math.round(100 - gap * 25));
    }
    // Overqualified — a warning, not a rejection.
    const over = candidateYears - max;
    return clamp(Math.round(100 - over * 10), 40);
  }

  private scoreLocation(
    job: MergedJob,
    prefs: CandidatePreferences,
    hardReject: Set<string>,
  ): { locationScore: number; locationMatch: boolean } {
    if (job.remoteType === "remote") return { locationScore: 100, locationMatch: true };
    const loc = normalizeText(job.location ?? "");
    const preferred = loc !== "" && [...prefs.preferredLocations].some((p) => p !== "remote" && (loc.includes(p) || p.includes(loc)));
    if (preferred) return { locationScore: job.remoteType === "hybrid" ? 90 : 85, locationMatch: true };
    if (!loc) return { locationScore: 60, locationMatch: false }; // unknown location
    if (job.remoteType === "hybrid") return { locationScore: 45, locationMatch: false };
    // Onsite in a non-preferred location with no remote option → not viable.
    hardReject.add(`onsite in unavailable location (${job.location})`);
    return { locationScore: 10, locationMatch: false };
  }

  private scoreEmployment(job: MergedJob, prefs: CandidatePreferences): { employmentScore: number; employmentMatch: boolean } {
    if (prefs.employmentTypes.size === 0 || !job.employmentType) return { employmentScore: 70, employmentMatch: true };
    const type = normalizeText(job.employmentType);
    const match = [...prefs.employmentTypes].some((t) => type.includes(t) || t.includes(type));
    return { employmentScore: match ? 100 : 30, employmentMatch: match };
  }

  private scoreSalary(job: MergedJob, prefs: CandidatePreferences): number {
    const expect = prefs.salaryExpectation;
    // No salary data on the job → neutral (missing data must not penalize).
    if (!job.salary || (job.salary.min === undefined && job.salary.max === undefined)) return 70;
    // No expectation configured → mild positive for having salary transparency.
    if (!expect || expect.min === undefined) return 80;
    // Currencies differ → we can't compare reliably; stay neutral.
    if (expect.currency && job.salary.currency && expect.currency !== job.salary.currency) return 70;
    const jobTop = job.salary.max ?? job.salary.min ?? 0;
    if (jobTop >= expect.min) return 100;
    // Below expectation: scale down by how far short it falls.
    const ratio = jobTop / expect.min;
    return clamp(Math.round(ratio * 100), 0);
  }

  private scoreFreshness(postedAt: Date | undefined): number {
    if (!postedAt) return 60; // missing date ≠ expired
    const ageHours = (Date.now() - postedAt.getTime()) / 3_600_000;
    const days = ageHours / 24;
    if (ageHours < 24) return 100;
    if (days <= 3) return 90;
    if (days <= 7) return 75;
    if (days <= 14) return 50;
    if (days <= 30) return 25;
    return 0;
  }

  private applyQualityRules(
    job: MergedJob,
    roleScore: number,
    skillsScore: number,
    details: RuleMatchDetails,
    hardReject: Set<string>,
    warnings: string[],
  ): void {
    const text = `${job.title} ${job.description}`;
    if (SPAM_PATTERNS.some((re) => re.test(text))) hardReject.add("suspected recruitment spam");
    if (EXPIRED_PATTERNS.some((re) => re.test(text))) hardReject.add("posting appears expired/closed");

    const infoBits = [job.description.trim(), ...job.skills, ...job.requirements].filter(Boolean).length;
    if (infoBits === 0) hardReject.add("insufficient job information");

    // Clearly-different role: weak title match AND essentially no skill overlap.
    const skillOverlap = details.matchedSkills.length + details.relatedSkills.length;
    if (roleScore < 20 && skillOverlap === 0 && job.skills.length > 0) {
      hardReject.add("role unrelated to candidate profile");
    }
    if (details.missingSkills.length > 0 && skillsScore < 100) {
      warnings.push(`missing skills: ${details.missingSkills.join(", ")}`);
    }
  }

  // ---- helpers ----------------------------------------------------------

  private parseExperience(text: string | undefined, description: string): { min?: number; max?: number } | undefined {
    const source = `${text ?? ""} ${description}`;
    const range = source.match(/(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*\+?\s*(years|yrs|year)/i);
    if (range) return { min: Number(range[1]), max: Number(range[2]) };
    const plus = source.match(/(\d{1,2})\s*\+\s*(years|yrs|year)/i);
    if (plus) return { min: Number(plus[1]) };
    const single = source.match(/(\d{1,2})\s*(years|yrs)\b/i);
    if (single) return { min: Number(single[1]), max: Number(single[1]) + 1 };
    return undefined;
  }

  private emptyDetails(candidateYears: number): RuleMatchDetails {
    return {
      matchedSkills: [],
      relatedSkills: [],
      missingSkills: [],
      experienceCandidate: candidateYears,
      locationMatch: false,
      employmentMatch: false,
      hardRejectReasons: [],
      warnings: [],
    };
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
