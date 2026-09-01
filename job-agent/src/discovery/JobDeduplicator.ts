import type { Job, JobSourceName, MergedJob } from "../domain/job.js";
import { canonicalizeUrl, normalizeLocation, normalizeTitle } from "../utils/text.js";
import { stringSimilarity, textSimilarity } from "../utils/similarity.js";

export interface DedupOptions {
  /** Title similarity above this (same company) counts as a duplicate. */
  titleThreshold: number;
  /** Description similarity above this (same company) counts as a duplicate. */
  descriptionThreshold: number;
}

const DEFAULT_OPTS: DedupOptions = { titleThreshold: 0.82, descriptionThreshold: 0.7 };

export interface DedupResult {
  merged: MergedJob[];
  duplicatesRemoved: number;
}

/**
 * Collapses jobs that refer to the same real-world position, even across
 * platforms. Uses several signals (exact fingerprint, canonical URL, external
 * id, and similarity of title/description within the same company) and a
 * union-find so transitive duplicates cluster together. Never blindly deletes:
 * every source that observed the position is preserved on the merged record.
 */
export class JobDeduplicator {
  constructor(private readonly opts: DedupOptions = DEFAULT_OPTS) {}

  deduplicate(jobs: Job[]): DedupResult {
    const n = jobs.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
      let root = x;
      while (parent[root] !== root) root = parent[root]!;
      while (parent[x] !== root) {
        const next = parent[x]!;
        parent[x] = root;
        x = next;
      }
      return root;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (this.isDuplicate(jobs[i]!, jobs[j]!)) union(i, j);
      }
    }

    const clusters = new Map<number, Job[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const list = clusters.get(root) ?? [];
      list.push(jobs[i]!);
      clusters.set(root, list);
    }

    const merged = [...clusters.values()].map((cluster) => this.merge(cluster));
    const duplicatesRemoved = n - merged.length;
    return { merged, duplicatesRemoved };
  }

  /** Public so tests and enrichment can reuse the pairwise decision. */
  isDuplicate(a: Job, b: Job): boolean {
    if (a.fingerprint === b.fingerprint) return true;

    const urlA = canonicalizeUrl(a.applicationUrl);
    const urlB = canonicalizeUrl(b.applicationUrl);
    if (urlA && urlA === urlB) return true;

    if (a.externalId && b.externalId && a.source === b.source && a.externalId === b.externalId) return true;

    // Same company + strong title/description similarity + compatible location.
    const sameCompany = normalizeTitle(a.company) === normalizeTitle(b.company);
    if (!sameCompany) return false;

    const titleSim = stringSimilarity(normalizeTitle(a.title), normalizeTitle(b.title));
    const locA = normalizeLocation(a.location);
    const locB = normalizeLocation(b.location);
    const compatibleLocation = locA === locB || locA === "" || locB === "" || locA.includes(locB) || locB.includes(locA);

    if (titleSim >= this.opts.titleThreshold && compatibleLocation) return true;

    if (a.description && b.description) {
      const descSim = textSimilarity(a.description, b.description);
      if (descSim >= this.opts.descriptionThreshold && titleSim >= 0.6 && compatibleLocation) return true;
    }
    return false;
  }

  /** Merge a cluster into one canonical record, preserving all sources. */
  private merge(cluster: Job[]): MergedJob {
    // Canonical = the most information-rich record (longest description wins,
    // ties broken by having a salary, then by earliest postedAt).
    const canonical = [...cluster].sort((a, b) => {
      const byDesc = (b.description?.length ?? 0) - (a.description?.length ?? 0);
      if (byDesc !== 0) return byDesc;
      const bySalary = (b.salary ? 1 : 0) - (a.salary ? 1 : 0);
      if (bySalary !== 0) return bySalary;
      return (a.postedAt?.getTime() ?? Infinity) - (b.postedAt?.getTime() ?? Infinity);
    })[0]!;

    const sources = [...new Set(cluster.map((j) => j.source))].sort() as JobSourceName[];
    const skills = [...new Set(cluster.flatMap((j) => j.skills))];
    const requirements = [...new Set(cluster.flatMap((j) => j.requirements))];
    const postedAt = cluster
      .map((j) => j.postedAt)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      ...canonical,
      skills,
      requirements,
      postedAt: postedAt ?? canonical.postedAt,
      sources,
      duplicateCount: cluster.length,
    };
  }
}
