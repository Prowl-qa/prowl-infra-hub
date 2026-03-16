import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { fetchStatsFromService } from '@/lib/stats-client';

function isAuthorized(authHeader: string | null, expectedKey: string | undefined) {
  if (!expectedKey || !authHeader) {
    return false;
  }

  const expectedHeader = `Bearer ${expectedKey}`;
  const provided = Buffer.from(authHeader, 'utf8');
  const expected = Buffer.from(expectedHeader, 'utf8');

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const expectedKey = process.env.STATS_API_KEY;
  const authHeader = request.headers.get('authorization');
  if (!isAuthorized(authHeader, expectedKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const result = await fetchStatsFromService({
    searchParams,
    timeoutMs: 5000,
    revalidate: 300,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
