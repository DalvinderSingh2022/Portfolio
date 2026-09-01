import type { Env } from "../config/env.js";
import type { MatchedJob } from "../domain/matching.js";
import { log } from "../utils/logger.js";
import { formatAlert, type Notifier } from "./Notifier.js";

/**
 * Email channel. Wiring an SMTP transport (e.g. nodemailer) is a Phase-3 task;
 * to keep Phase 1 dependency-free and side-effect-free, this notifier composes
 * the message and logs that it *would* send when enabled but not yet wired.
 * It never sends without full SMTP configuration.
 */
export class EmailNotifier implements Notifier {
  readonly channel = "email" as const;
  readonly enabled: boolean;
  private readonly logger = log("notify-email");

  constructor(private readonly env: Env) {
    this.enabled = env.ENABLE_EMAIL_NOTIFICATIONS;
  }

  private get configured(): boolean {
    return Boolean(this.env.SMTP_HOST && this.env.NOTIFY_TO && this.env.NOTIFY_FROM);
  }

  async send(matched: MatchedJob): Promise<void> {
    if (!this.enabled) return;
    const body = formatAlert(matched);
    if (!this.configured) {
      this.logger.warn(
        { jobId: matched.job.id },
        "email enabled but SMTP not fully configured — skipping send (composed message below)",
      );
      this.logger.debug({ body }, "composed email");
      return;
    }
    // Phase 3: send via SMTP transport here. Intentionally not sending yet.
    this.logger.info(
      { to: this.env.NOTIFY_TO, subject: `[Job Agent] ${matched.match.finalScore}% — ${matched.job.title}` },
      "email transport not wired (Phase 3); would send alert",
    );
  }
}
