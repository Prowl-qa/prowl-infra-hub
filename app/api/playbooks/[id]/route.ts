import { NextResponse } from 'next/server';

import { getPublishedPlaybooks } from '@/lib/playbooks';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playbooks = await getPublishedPlaybooks();
  const playbook = playbooks.find((p) => p.id === id);

  if (!playbook) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: playbook.id,
    name: playbook.name,
    title: playbook.title,
    description: playbook.description,
    category: playbook.category,
    categoryLabel: playbook.categoryLabel,
    tags: playbook.tags,
    tool: playbook.tool,
    cloud_provider: playbook.cloudProvider,
    os_family: playbook.osFamily,
    risk_level: playbook.riskLevel,
    compliance_tags: playbook.complianceTags,
    taskCount: playbook.taskCount,
    updatedAt: playbook.updatedAt,
    isVerified: playbook.isVerified,
    content: playbook.content,
    downloadUrl: `/api/playbooks/file?path=${encodeURIComponent(playbook.filePath)}`,
  });
}
