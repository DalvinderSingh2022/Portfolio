import type { JobSourceName } from "../../domain/job.js";
import { BaseAdapter } from "../BaseAdapter.js";

/**
 * Wellfound (formerly AngelList Talent). Wire an official API/partner feed or a
 * user-provided export here. No unauthorized scraping.
 */
export class WellfoundAdapter extends BaseAdapter {
  readonly name: JobSourceName = "wellfound";
  protected readonly integrationNote =
    "Use an official Wellfound API/feed or a user-provided export; do not scrape.";
}
