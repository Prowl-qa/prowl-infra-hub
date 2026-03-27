import { NextResponse } from 'next/server';

import { getPlaybookDownloadUrl, getPublishedPlaybooks } from '@/lib/playbooks';

export async function GET() {
  const playbooks = await getPublishedPlaybooks();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    playbooks: playbooks.map((playbook) => ({
      ...playbook,
      downloadUrl: getPlaybookDownloadUrl(playbook.filePath),
    })),
  });
}
