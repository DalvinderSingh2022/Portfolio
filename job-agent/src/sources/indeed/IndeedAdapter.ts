import type { JobSourceName } from "../../domain/job.js";
import { BaseAdapter } from "../BaseAdapter.js";

/**
 * Indeed. Wire the official Indeed Publisher/Employer API (partner credentials)
 * or an approved feed here. No unauthorized scraping.
 */
export class IndeedAdapter extends BaseAdapter {
  readonly name: JobSourceName = "indeed";
  protected readonly integrationNote =
    "Use the official Indeed partner API / approved feed; do not scrape search pages.";
}
