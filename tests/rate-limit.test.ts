import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRateLimitChecker, type RateLimitResult, type RateLimitStore } from '../lib/rate-limit.ts';

function allowedResult(limit: number, remaining: number): RateLimitResult {
  return {
    allowed: true,
    limit,
    remaining,
    retryAfterSeconds: 0,
    resetAt: 1_000,
  };
}

test('memory-only mode warns once and keeps using the fallback store', async () => {
  const warnings: unknown[][] = [];
  let memoryCalls = 0;

  const memoryStore: RateLimitStore = {
    async check() {
      memoryCalls++;
      return allowedResult(5, 4);
    },
  };

  const checkRateLimit = createRateLimitChecker({
    memoryStore,
    sharedStore: null,
    warn: (...args) => warnings.push(args),
  });

  await checkRateLimit('key', 5, 1_000);
  await checkRateLimit('key', 5, 1_000);

  assert.equal(memoryCalls, 2);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0]?.[0]), /Using in-memory store/);
});

test('shared-store fallback retries after the cooldown and recovers automatically', async () => {
  const warnings: unknown[][] = [];
  let currentTime = 0;
  let sharedCalls = 0;
  let memoryCalls = 0;

  const sharedStore: RateLimitStore = {
    async check() {
      sharedCalls++;
      if (sharedCalls === 1) {
        throw new Error('temporary outage');
      }

      return allowedResult(10, 8);
    },
  };

  const memoryStore: RateLimitStore = {
    async check() {
      memoryCalls++;
      return allowedResult(10, 9);
    },
  };

  const checkRateLimit = createRateLimitChecker({
    sharedStore,
    memoryStore,
    retryCooldownMs: 100,
    now: () => currentTime,
    warn: (...args) => warnings.push(args),
  });

  const firstResult = await checkRateLimit('key', 10, 1_000);
  assert.equal(firstResult.remaining, 9);
  assert.equal(sharedCalls, 1);
  assert.equal(memoryCalls, 1);
  assert.match(String(warnings[0]?.[0]), /falling back to in-memory limits/);

  currentTime = 50;
  const secondResult = await checkRateLimit('key', 10, 1_000);
  assert.equal(secondResult.remaining, 9);
  assert.equal(sharedCalls, 1);
  assert.equal(memoryCalls, 2);

  currentTime = 100;
  const recoveredResult = await checkRateLimit('key', 10, 1_000);
  assert.equal(recoveredResult.remaining, 8);
  assert.equal(sharedCalls, 2);
  assert.equal(memoryCalls, 2);
  assert.equal(warnings.length, 2);
  assert.match(String(warnings[1]?.[0]), /Shared store recovered/);
});
