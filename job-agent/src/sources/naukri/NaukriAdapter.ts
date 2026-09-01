import type { JobSourceName } from "../../domain/job.js";
import { BaseAdapter } from "../BaseAdapter.js";

/**
 * Naukri. Wire an official/partner API or a user-provided export here. No
 * unauthorized scraping of authenticated pages.
 */
export class NaukriAdapter extends BaseAdapter {
  readonly name: JobSourceName = "naukri";
  protected readonly integrationNote =
    "Use an official Naukri partner API or a user-provided export; do not scrape.";
}
