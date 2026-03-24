import { eq, and, sql, ilike, type SQL } from 'drizzle-orm';

import type { PlaybookCategory, PlaybookSummary, PlaybookRecord } from '@/lib/playbooks';

import { db } from './index';
import { playbooks, type Playbook } from './schema';

const CATEGORY_LABELS: Record<string, string> = {
  patching: 'Patching',
  provisioning: 'Provisioning',
  security: 'Security',
  monitoring: 'Monitoring',
  containers: 'Containers',
  networking: 'Networking',
  backup: 'Backup',
  configuration: 'Configuration',
  'ci-cd': 'CI/CD',
};

function toSummary(row: Playbook): PlaybookSummary {
  return {
    id: row.filePath.replace(/[/.]/g, '-'),
    title: row.title,
    name: row.name,
    description: row.description,
    category: row.category as PlaybookCategory,
    categoryLabel: CATEGORY_LABELS[row.category] || row.category,
    filePath: row.filePath,
    tool: row.tool as PlaybookSummary['tool'],
    cloudProvider: row.cloudProvider as PlaybookSummary['cloudProvider'],
    osFamily: row.osFamily as PlaybookSummary['osFamily'],
    riskLevel: row.riskLevel as PlaybookSummary['riskLevel'],
    complianceTags: row.complianceTags,
    taskCount: row.taskCount,
    tags: row.tags,
    updatedAt: row.updatedAt.toISOString(),
    isVerified: row.isVerified,
    isNew: Date.now() - row.updatedAt.getTime() <= 30 * 24 * 60 * 60 * 1000,
    tested: row.tested,
    testedOn: row.testedOn,
  };
}

function toRecord(row: Playbook): PlaybookRecord {
  return {
    ...toSummary(row),
    content: row.content,
  };
}

export async function getPublishedPlaybooks(): Promise<PlaybookRecord[]> {
  const rows = await db
    .select()
    .from(playbooks)
    .where(eq(playbooks.isVerified, true))
    .orderBy(playbooks.title);

  return rows.map(toRecord);
}

export async function getPublishedPlaybookSummaries(): Promise<PlaybookSummary[]> {
  const rows = await db
    .select()
    .from(playbooks)
    .where(eq(playbooks.isVerified, true))
    .orderBy(playbooks.title);

  return rows.map(toSummary);
}

export async function getFeaturedPlaybooks(): Promise<PlaybookSummary[]> {
  const rows = await db
    .select()
    .from(playbooks)
    .where(and(eq(playbooks.isVerified, true), eq(playbooks.isFeatured, true)))
    .orderBy(playbooks.title);

  return rows.map(toSummary);
}

export async function getPlaybookContent(filePath: string): Promise<string | null> {
  const rows = await db
    .select({ content: playbooks.content })
    .from(playbooks)
    .where(eq(playbooks.filePath, filePath))
    .limit(1);

  return rows[0]?.content ?? null;
}

export async function getPlaybookBySlug(slug: string): Promise<PlaybookRecord | null> {
  const rows = await db
    .select()
    .from(playbooks)
    .where(eq(playbooks.slug, slug))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

interface SearchOptions {
  q?: string;
  category?: string;
  tool?: string;
  cloudProvider?: string;
  riskLevel?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export async function searchPlaybooks(opts: SearchOptions) {
  const conditions: SQL[] = [eq(playbooks.isVerified, true)];

  if (opts.category) {
    conditions.push(eq(playbooks.category, opts.category));
  }
  if (opts.tool) {
    conditions.push(eq(playbooks.tool, opts.tool));
  }
  if (opts.cloudProvider) {
    conditions.push(eq(playbooks.cloudProvider, opts.cloudProvider));
  }
  if (opts.riskLevel) {
    conditions.push(eq(playbooks.riskLevel, opts.riskLevel));
  }
  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      conditions.push(sql`${playbooks.tags} @> ${JSON.stringify([tag])}::jsonb`);
    }
  }
  if (opts.q) {
    conditions.push(
      sql`to_tsvector('english', ${playbooks.title} || ' ' || ${playbooks.description} || ' ' || ${playbooks.name}) @@ plainto_tsquery('english', ${opts.q})`
    );
  }

  const where = and(...conditions);
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(playbooks)
      .where(where)
      .orderBy(playbooks.title)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(playbooks)
      .where(where),
  ]);

  return {
    total: Number(countResult[0]?.count ?? 0),
    results: rows.map(toSummary),
  };
}

export async function deletePlaybookByFilePath(filePath: string): Promise<boolean> {
  const result = await db
    .delete(playbooks)
    .where(eq(playbooks.filePath, filePath))
    .returning({ id: playbooks.id });

  return result.length > 0;
}
