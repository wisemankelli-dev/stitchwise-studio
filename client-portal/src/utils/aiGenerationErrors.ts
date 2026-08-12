/**
 * Maps AI-generation failures to honest, friendly user-facing messages.
 *
 * Failure modes handled (in priority order):
 *  - 401   → our own auth: the user isn't signed in (backend returns
 *            "Missing or invalid Authorization header" for anonymous AI calls).
 *  - 429   → per-tier rate limit enforced by the backend.
 *  - 402/403 → plan/allowance restrictions.
 *  - AbortError/TimeoutError → client-side guard so the UI can never look hung.
 *  - TypeError/status 0 → network failure (fetch couldn't reach the backend).
 *  - 5xx   → backend or upstream (OpenAI) failure.
 *  - any other specific backend message → surfaced as-is, unless it's one of the
 *    generic client stubs (e.g. "AI collage generation failed"), which are
 *    replaced by the caller's friendly fallback.
 */
export function describeAiGenerationError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; message?: string; name?: string };
    if (e.status === 401) {
      return 'Please sign in to use AI generation.';
    }
    if (e.status === 429) {
      return 'You have used up your AI generation allowance for now. Please try again in a little while.';
    }
    if (e.status === 402 || e.status === 403) {
      return 'AI generation is not available on your current plan. Please upgrade to keep creating.';
    }
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return 'This took longer than expected, so it was stopped. Please try again.';
    }
    if (e.status && e.status >= 500) {
      return 'The generation service hit an unexpected error. Please try again in a moment.';
    }
    if (e.name === 'TypeError' || e.status === 0) {
      return "We couldn't reach the generation service. Please check your connection and try again.";
    }
    // Provider-side image failures surface as opaque backend messages
    // (e.g. "AI generation returned no image" when the upstream OpenAI call
    // fails after retries — 429 no-credits, 5xx, timeouts). Translate them
    // into an honest, friendly status instead of the technical string.
    if (e.message && /no image|credits|billing|image service/i.test(e.message)) {
      return 'The AI image service is temporarily unavailable. Please try again in a little while.';
    }
    // Surface a specific backend-provided message if it isn't a generic client stub.
    if (e.message && !/generation failed|request failed/i.test(e.message)) {
      return e.message;
    }
  }
  return fallback;
}
