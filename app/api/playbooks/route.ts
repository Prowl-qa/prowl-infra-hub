import { NextResponse } from 'next/server';

import { getPublishedPlaybooks } from '@/lib/playbooks';

export async function GET() {
  const playbooks = await getPublishedPlaybooks();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    playbooks,
  });
}
