import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { log } from "../../utils/logger.js";
import { CompaniesConfigSchema, type CompanyBoard } from "./ats/types.js";

const DEFAULT_PATH = "./data/sources/companies.json";

/**
 * Load the per-company ATS board config. Missing/invalid file ⇒ empty list
 * (the source simply finds nothing rather than crashing the pipeline).
 */
export async function loadCompanies(path = process.env.COMPANIES_CONFIG_PATH ?? DEFAULT_PATH): Promise<CompanyBoard[]> {
  const file = resolve(path);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch {
    log("company-careers").warn({ file }, "no companies config found — company-careers source will find nothing");
    return [];
  }
  const parsed = CompaniesConfigSchema.safeParse(raw);
  if (!parsed.success) {
    log("company-careers").warn({ file }, "invalid companies config — ignoring");
    return [];
  }
  return parsed.data.companies.filter((c) => c.enabled);
}
