import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null | undefined;

/** Lazily-created shared Anthropic client. Returns null if the API key isn't
 * set, so callers can degrade gracefully (e.g. hide "Generate using AI")
 * instead of the route crashing. */
export function getAnthropicClient(): Anthropic | null {
  if (client !== undefined) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    client = null;
    return client;
  }

  client = new Anthropic({ apiKey });
  return client;
}
