import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { checkRateLimit } from '@/lib/rate-limit';

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/playbooks/search': { max: 30, windowMs: 60_000 },
  '/api/playbooks/file': { max: 30, windowMs: 60_000 },
  '/api/playbooks': { max: 60, windowMs: 60_000 },
};

const DEFAULT_LIMIT = { max: 60, windowMs: 60_000 };

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);

  let config = DEFAULT_LIMIT;
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) {
      config = limit;
      break;
    }
  }

  const key = `${ip}:${pathname}`;
  const result = checkRateLimit(key, config.max, config.windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
