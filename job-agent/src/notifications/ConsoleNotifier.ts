import { log } from "../utils/logger.js";
import type { MatchedJob } from "../domain/matching.js";
import { formatAlert, type Notifier } from "./Notifier.js";

/** Prints high-match alerts to the console. Always safe / always available. */
export class ConsoleNotifier implements Notifier {
  readonly channel = "console" as const;
  readonly enabled = true;
  private readonly logger = log("notify");

  async send(matched: MatchedJob): Promise<void> {
    // Emit as a plain block so it reads well in a terminal.
    // eslint-disable-next-line no-console
    console.log("\n" + formatAlert(matched) + "\n");
    this.logger.debug({ jobId: matched.job.id, score: matched.match.finalScore }, "console alert sent");
  }
}
