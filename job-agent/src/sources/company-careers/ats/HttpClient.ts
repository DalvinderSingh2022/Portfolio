import { withRetry } from "../../../utils/rateLimit.js";

/**
 * A tiny JSON-over-HTTP seam. Injectable so ATS clients can be unit-tested with
 * recorded fixtures instead of hitting the network.
 */
export interface HttpJsonClient {
  getJson<T>(url: string): Promise<T>;
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  /** Polite identifier so operators of the boards can see who is calling. */
  userAgent?: string;
}

/** Default client backed by global `fetch`, with timeout + retry/backoff. */
export class FetchHttpClient implements HttpJsonClient {
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly userAgent: string;

  constructor(options: FetchOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
    this.userAgent = options.userAgent ?? "job-agent/0.1 (+https://github.com/; contact: local)";
  }

  async getJson<T>(url: string): Promise<T> {
    return withRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const res = await fetch(url, {
            headers: { accept: "application/json", "user-agent": this.userAgent },
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new HttpError(res.status, `GET ${redact(url)} -> HTTP ${res.status}`);
          }
          return (await res.json()) as T;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        retries: this.retries,
        baseDelayMs: 500,
        // Do not retry 4xx (client errors like an unknown board) — only 5xx/network.
        shouldRetry: (err) => !(err instanceof HttpError) || err.status >= 500,
      },
    );
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Strip any query string before logging a URL (defensive; boards use none). */
function redact(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}
