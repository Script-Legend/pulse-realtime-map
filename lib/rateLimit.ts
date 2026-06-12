// Best-effort in-memory rate limiter. On serverless (Vercel) each instance has
// its own memory, so this is a soft guard, not a hard cap — a strict limiter
// needs a shared store (e.g. Redis), which the project's "no external services"
// rule rules out. It still stops a single client from hammering an endpoint
// within an instance, which covers the common-case abuse.
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
let lastPrune = 0;

// Drop expired windows occasionally so the map can't grow unbounded.
function prune(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, w] of buckets) {
    if (now >= w.resetAt) buckets.delete(key);
  }
}

// Returns true if allowed, false if the request should be rejected (429).
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);
  const w = buckets.get(key);
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= limit) return false;
  w.count++;
  return true;
}

// Best-effort client IP from proxy headers, used to key the limiter.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
