import type { Env } from "../../config/env.js";
import type { LLMPrompt } from "../prompts/job-match.prompt.js";

/**
 * Provider-agnostic LLM seam. The rest of the app depends only on this
 * interface, so swapping OpenAI ↔ Anthropic ↔ a local model is a one-line
 * change in the factory.
 */
export interface LLMClient {
  readonly provider: string;
  complete(prompt: LLMPrompt): Promise<string>;
}

/**
 * Deterministic, offline client used in tests and local runs. It does NOT call
 * a network. It returns a valid, schema-shaped JSON string derived from the
 * prompt so the parse → validate → cache path is fully exercised without keys.
 */
export class MockLLMClient implements LLMClient {
  readonly provider = "mock";
  async complete(prompt: LLMPrompt): Promise<string> {
    // Cheap deterministic signal from the prompt length so output is stable.
    const seed = (prompt.user.length % 20) - 10; // -10..9
    const base = 78 + seed;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    const rec = base >= 85 ? "highly_relevant" : base >= 75 ? "relevant" : base >= 65 ? "possible" : "weak";
    return JSON.stringify({
      overallScore: clamp(base),
      skillsMatch: clamp(base + 2),
      experienceMatch: clamp(base - 3),
      roleMatch: clamp(base + 4),
      locationMatch: clamp(base + 6),
      confidence: 0.6,
      strengths: ["Deterministic mock evaluation"],
      gaps: [],
      redFlags: [],
      recommendation: rec,
    });
  }
}

/**
 * Real providers are wired in Phase 3. They are intentionally not making network
 * calls yet; enabling LLM matching with a real provider before wiring throws a
 * clear error rather than silently doing nothing.
 */
class UnwiredProviderClient implements LLMClient {
  constructor(public readonly provider: string) {}
  async complete(): Promise<string> {
    throw new Error(
      `LLM provider "${this.provider}" is not wired yet (Phase 3). ` +
        `Set LLM_PROVIDER=mock for offline runs, or implement the ${this.provider} client.`,
    );
  }
}

export function createLLMClient(env: Env): LLMClient {
  switch (env.LLM_PROVIDER) {
    case "mock":
      return new MockLLMClient();
    case "openai":
    case "anthropic":
      return new UnwiredProviderClient(env.LLM_PROVIDER);
    default:
      return new MockLLMClient();
  }
}
