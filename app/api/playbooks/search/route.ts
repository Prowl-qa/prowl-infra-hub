import { NextResponse } from 'next/server';

import { getPlaybookDownloadUrl, getPublishedPlaybookSummaries } from '@/lib/playbooks';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const category = searchParams.get('category') || '';
  const tagsParam = searchParams.get('tags') || '';
  const tool = searchParams.get('tool') || '';
  const cloudProvider = searchParams.get('cloud_provider') || '';
  const riskLevel = searchParams.get('risk_level') || '';
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit')) || 20), 100);
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

  const requestedTags = tagsParam
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  // Try DB-backed search first, fall back to in-memory filtering
  try {
    const { searchPlaybooks } = await import('@/lib/db/queries');
    const { total, results } = await searchPlaybooks({
      q: q || undefined,
      category: category || undefined,
      tool: tool || undefined,
      cloudProvider: cloudProvider || undefined,
      riskLevel: riskLevel || undefined,
      tags: requestedTags.length > 0 ? requestedTags : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      query: q || undefined,
      total,
      limit,
      offset,
      results: results.map((playbook) => ({
        ...playbook,
        downloadUrl: getPlaybookDownloadUrl(playbook.filePath),
      })),
    });
  } catch (err) {
    console.warn('[search] DB search unavailable, falling back to in-memory filtering', err);
  }

  const allPlaybooks = await getPublishedPlaybookSummaries();

  const filtered = allPlaybooks.filter((playbook) => {
    if (category && playbook.category !== category) return false;
    if (tool && playbook.tool !== tool) return false;
    if (cloudProvider && playbook.cloudProvider !== cloudProvider) return false;
    if (riskLevel && playbook.riskLevel !== riskLevel) return false;

    if (requestedTags.length > 0) {
      const playbookTags = playbook.tags.map((t) => t.toLowerCase());
      if (!requestedTags.every((t) => playbookTags.includes(t))) return false;
    }

    if (q) {
      const searchable = `${playbook.title} ${playbook.description} ${playbook.categoryLabel} ${playbook.tags.join(' ')}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    return true;
  });

  const results = filtered.slice(offset, offset + limit).map((playbook) => ({
    ...playbook,
    downloadUrl: getPlaybookDownloadUrl(playbook.filePath),
  }));

  return NextResponse.json({
    query: q || undefined,
    total: filtered.length,
    limit,
    offset,
    results,
  });
}
