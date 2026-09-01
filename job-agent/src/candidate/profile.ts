import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getEnv } from "../config/env.js";
import { CandidateProfileSchema, type CandidateProfile, type LoadedCandidate } from "../domain/candidate.js";
import { loadResume } from "./resume.js";

/** Load and validate the candidate profile JSON from disk. */
export async function loadProfile(path?: string): Promise<CandidateProfile> {
  const env = getEnv();
  const file = resolve(path ?? env.CANDIDATE_PROFILE_PATH);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read candidate profile at ${file}: ${(error as Error).message}`);
  }
  const parsed = CandidateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid candidate profile (${file}):\n${issues}`);
  }
  return parsed.data;
}

/** Load profile + resume together. */
export async function loadCandidate(): Promise<LoadedCandidate> {
  const [profile, resume] = await Promise.all([loadProfile(), loadResume()]);
  return { profile, resume };
}
