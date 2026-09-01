import { pino, type Logger } from "pino";
import { getEnv } from "../config/env.js";

/**
 * Keys that must never be logged. `redact` replaces their values with [REDACTED]
 * anywhere they appear in a log object.
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "cookie",
  "*.cookie",
  "cookies",
  "*.cookies",
  "token",
  "*.token",
  "sessionToken",
  "*.sessionToken",
  "apiKey",
  "*.apiKey",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "secret",
  "*.secret",
];

let root: Logger | null = null;

function build(): Logger {
  const env = getEnv();
  return pino({
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    ...(env.LOG_PRETTY
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
          },
        }
      : {}),
  });
}

export function logger(): Logger {
  if (!root) root = build();
  return root;
}

/** Child logger scoped to a component, e.g. `log("linkedin")`. */
export function log(component: string): Logger {
  return logger().child({ component });
}
