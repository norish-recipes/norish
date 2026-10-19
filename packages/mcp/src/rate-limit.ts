export type RateLimitResult =
  { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

export const MCP_RATE_LIMIT_PER_MINUTE = 120;

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  consume(key: string): RateLimitResult {
    const current = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= current) {
      this.sweep(current);
      this.buckets.set(key, { count: 1, resetAt: current + this.windowMs });

      return { allowed: true, remaining: this.limit - 1 };
    }

    if (bucket.count >= this.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
      };
    }

    bucket.count += 1;

    return { allowed: true, remaining: this.limit - bucket.count };
  }

  private sweep(current: number): void {
    if (this.buckets.size < 1000) return;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= current) this.buckets.delete(key);
    }
  }
}

export const mcpRateLimiter = new FixedWindowRateLimiter(MCP_RATE_LIMIT_PER_MINUTE, 60_000);
