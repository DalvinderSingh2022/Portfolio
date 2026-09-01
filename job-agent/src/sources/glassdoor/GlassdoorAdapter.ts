import type { JobSourceName } from "../../domain/job.js";
import { BaseAdapter } from "../BaseAdapter.js";

/**
 * Glassdoor. Wire an official/partner API here. No unauthorized scraping of
 * authenticated or anti-bot-protected pages.
 */
export class GlassdoorAdapter extends BaseAdapter {
  readonly name: JobSourceName = "glassdoor";
  protected readonly integrationNote =
    "Use an official Glassdoor partner API; do not scrape.";
}
