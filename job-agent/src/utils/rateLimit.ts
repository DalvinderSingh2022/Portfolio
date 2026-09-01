/**
 * Small, dependency-free reliability helpers used by source adapters:
 * retries with exponential backoff, request timeouts, and a simple
 * minimum-interval rate limiter. These are the guardrails that keep the agent
 * polite toward job platforms.
 */

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  /** Return false to stop retrying a given error. */
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    timeoutMs = 0,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) break;
      // Exponential backoff with light jitter (deterministic-ish, no crypto rand needed).
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = backoff * 0.2 * ((attempt % 3) / 3);
      const delay = Math.round(backoff + jitter);
      onRetry?.(attempt + 1, error, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}

/** Enforces a minimum spacing between successive calls (per adapter). */
export class RateLimiter {
  private last = 0;
  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.last;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.last = Date.now();
  }
}
