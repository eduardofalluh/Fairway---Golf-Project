/**
 * Best-effort per-client limiter for API routes. It lives in one serverless
 * instance's memory, so it slows bursts rather than enforcing a global quota.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function check(key: string): { limited: boolean; retryAfterSec: number } {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { limited: true, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return { limited: false, retryAfterSec: 0 };
  };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
}
