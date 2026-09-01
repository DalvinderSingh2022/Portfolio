import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SearchConfigSchema, type SearchConfig } from "../domain/search.js";
import { getEnv } from "./env.js";

/** Load and validate the search configuration JSON. */
export async function loadSearchConfig(path?: string): Promise<SearchConfig> {
  const env = getEnv();
  const file = resolve(path ?? env.SEARCH_CONFIG_PATH);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read search config at ${file}: ${(error as Error).message}`);
  }
  const parsed = SearchConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid search config (${file}):\n${issues}`);
  }
  return parsed.data;
}
