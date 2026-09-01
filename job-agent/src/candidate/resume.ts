import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getEnv } from "../config/env.js";

/** Load the candidate resume markdown. Returns "" if the file is absent. */
export async function loadResume(path?: string): Promise<string> {
  const env = getEnv();
  const file = resolve(path ?? env.CANDIDATE_RESUME_PATH);
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}
