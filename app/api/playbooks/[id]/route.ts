import { NextResponse } from 'next/server';

import { getPlaybookDownloadUrl, getPublishedPlaybookById } from '@/lib/playbooks';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playbook = await getPublishedPlaybookById(id);

  if (!playbook) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...playbook,
    downloadUrl: getPlaybookDownloadUrl(playbook.filePath),
  });
}
