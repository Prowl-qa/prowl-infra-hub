interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

interface RateLimitStore {
  check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private static readonly CLEANUP_INTERVAL_MS = 60_000;

  private cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < MemoryRateLimitStore.CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;

    for (const [key, entry] of this.store) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async check(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    this.cleanup();

    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        retryAfterSeconds: 0,
        resetAt,
      };
    }

    if (entry.count < maxRequests) {
      entry.count++;
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - entry.count,
        retryAfterSeconds: 0,
        resetAt: entry.resetAt,
      };
    }

    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      retryAfterSeconds,
      resetAt: entry.resetAt,
    };
  }
}

class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  private async command<T>(
    validate: (result: unknown) => result is T,
    ...parts: string[]
  ): Promise<T> {
    const encodedPath = parts.map((part) => encodeURIComponent(part)).join('/');
    const response = await fetch(`${this.baseUrl}/${encodedPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Upstash rate-limit request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { result?: unknown };
    if (!('result' in payload) || payload.result === undefined) {
      throw new Error('Upstash rate-limit response did not include a result');
    }

    if (!validate(payload.result)) {
      throw new Error('Upstash rate-limit response returned an unexpected result shape');
    }

    return payload.result;
  }

  async check(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const [count, ttlMs] = await this.command(
      isRateLimitScriptResult,
      'EVAL',
      RATE_LIMIT_LUA_SCRIPT,
      '1',
      key,
      String(windowMs)
    );
    const normalizedTtlMs = Math.max(0, ttlMs);
    const resetAt = now + normalizedTtlMs;

    if (count <= maxRequests) {
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - count,
        retryAfterSeconds: 0,
        resetAt,
      };
    }

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(normalizedTtlMs / 1000)),
      resetAt,
    };
  }
}

const RATE_LIMIT_LUA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])

if current == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

return { current, ttl }
`.trim();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRateLimitScriptResult(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1])
  );
}

const memoryStore = new MemoryRateLimitStore();
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let activeStore: RateLimitStore =
  upstashUrl && upstashToken
    ? new UpstashRateLimitStore(upstashUrl.replace(/\/$/, ''), upstashToken)
    : memoryStore;

let warnedAboutMemoryStore = false;

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (activeStore === memoryStore && !warnedAboutMemoryStore) {
    warnedAboutMemoryStore = true;
    console.warn(
      '[rate-limit] Using in-memory store; limits are best-effort per runtime instance. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for shared enforcement.'
    );
  }

  try {
    return await activeStore.check(key, maxRequests, windowMs);
  } catch (error) {
    if (activeStore !== memoryStore) {
      console.warn('[rate-limit] Shared store unavailable, falling back to in-memory limits', error);
      activeStore = memoryStore;
      return memoryStore.check(key, maxRequests, windowMs);
    }

    throw error;
  }
}
