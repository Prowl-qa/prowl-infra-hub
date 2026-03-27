import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getClientIpFromRequest, type ClientIpRequestLike } from '../lib/request-ip.ts';

function makeRequest(
  overrides: Partial<ClientIpRequestLike> = {},
  headerEntries: Array<[string, string]> = []
): ClientIpRequestLike {
  return {
    headers: new Headers(headerEntries),
    method: 'GET',
    nextUrl: {
      host: 'infra.prowlqa.dev',
      hostname: 'infra.prowlqa.dev',
      pathname: '/api/playbooks/search',
    },
    ...overrides,
  };
}

test('getClientIpFromRequest prefers request.ip when present', () => {
  const request = makeRequest(
    { ip: '198.51.100.10' },
    [
      ['x-real-ip', '203.0.113.1'],
      ['x-forwarded-for', '203.0.113.2, 203.0.113.3'],
    ]
  );

  assert.equal(getClientIpFromRequest(request), '198.51.100.10');
});

test('getClientIpFromRequest falls back to x-forwarded-for when x-real-ip is absent', () => {
  const request = makeRequest({}, [['x-forwarded-for', '203.0.113.2, 203.0.113.3']]);

  assert.equal(getClientIpFromRequest(request), '203.0.113.2');
});

test('getClientIpFromRequest still returns localhost when no trusted headers are present locally', () => {
  const request = makeRequest({
    nextUrl: {
      host: 'localhost:3004',
      hostname: 'localhost',
      pathname: '/api/playbooks',
    },
  });

  assert.equal(getClientIpFromRequest(request), '127.0.0.1');
});
