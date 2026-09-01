import type { JobSourceName } from "../../domain/job.js";
import { BaseAdapter } from "../BaseAdapter.js";

/**
 * LinkedIn Jobs. Automated scraping of LinkedIn violates its User Agreement and
 * is gated behind authentication/anti-bot measures, so this adapter does NOT
 * scrape. Permitted paths to wire here later: the official LinkedIn Talent /
 * Job Posting APIs (partner access), or a user-provided export of saved jobs.
 */
export class LinkedInAdapter extends BaseAdapter {
  readonly name: JobSourceName = "linkedin";
  protected readonly integrationNote =
    "Use the official LinkedIn partner API or a user-provided saved-jobs export; do not scrape.";
}
