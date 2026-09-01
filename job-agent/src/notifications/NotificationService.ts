import type { MatchedJob } from "../domain/matching.js";
import type { Storage } from "../storage/repositories/types.js";
import { log } from "../utils/logger.js";
import type { Notifier } from "./Notifier.js";

/**
 * Fans a high-match job out to every enabled notifier, once. Notifies only when
 * the score clears the threshold, and records a Notification so the same job is
 * not alerted repeatedly across runs.
 */
export class NotificationService {
  private readonly logger = log("notify");

  constructor(
    private readonly notifiers: Notifier[],
    private readonly storage: Storage,
    private readonly threshold: number,
  ) {}

  async maybeNotify(matched: MatchedJob): Promise<boolean> {
    if (matched.match.finalScore < this.threshold) return false;
    if (await this.storage.notifications.existsForJob(matched.job.id)) return false;

    const active = this.notifiers.filter((n) => n.enabled);
    for (const notifier of active) {
      try {
        await notifier.send(matched);
        await this.storage.notifications.create({
          jobId: matched.job.id,
          channel: notifier.channel,
          score: matched.match.finalScore,
          title: matched.job.title,
          company: matched.job.company,
        });
      } catch (error) {
        this.logger.warn({ channel: notifier.channel, err: (error as Error).message }, "notifier failed");
      }
    }
    return active.length > 0;
  }

  async notifyAll(matches: MatchedJob[]): Promise<number> {
    let sent = 0;
    for (const m of matches) {
      if (await this.maybeNotify(m)) sent++;
    }
    return sent;
  }
}
