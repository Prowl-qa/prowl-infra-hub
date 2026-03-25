export const PUBLISHED_DIRS = ['patching', 'provisioning', 'security', 'monitoring', 'containers', 'networking', 'backup', 'configuration', 'ci-cd'] as const;

export type PlaybookCategory = (typeof PUBLISHED_DIRS)[number];

export type RiskLevel = 'low' | 'medium' | 'high';
export type Tool = 'ansible' | 'terraform' | 'docker-compose' | 'k8s';
export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'agnostic';
export type OsFamily = 'debian' | 'rhel' | 'agnostic';

export interface PlaybookSummary {
  id: string;
  title: string;
  name: string;
  description: string;
  category: PlaybookCategory;
  categoryLabel: string;
  filePath: string;
  tool: Tool;
  cloudProvider: CloudProvider;
  osFamily: OsFamily;
  riskLevel: RiskLevel;
  complianceTags: string[];
  taskCount: number;
  tags: string[];
  updatedAt: string;
  isVerified: boolean;
  isNew: boolean;
  tested: boolean;
  testedOn: Array<{ os: string; arch: string }>;
}

export interface PlaybookRecord extends PlaybookSummary {
  content: string;
}

import * as dbQueries from './db/queries.ts';
import {
  getPublishedPlaybooksFromFs,
  getPublishedPlaybookSummariesFromFs,
  readPublishedPlaybookFromFs,
} from './playbooks-fs.ts';

const CACHE_TTL_MS = 30_000;

interface PlaybooksCache {
  expiresAt: number;
  playbooks: PlaybookRecord[];
  playbookById: Map<string, PlaybookRecord>;
  pending: Promise<PlaybookRecord[]> | null;
}

const playbooksCache: PlaybooksCache = {
  expiresAt: 0,
  playbooks: [],
  playbookById: new Map(),
  pending: null,
};

function clonePlaybookRecord(p: PlaybookRecord): PlaybookRecord {
  return { ...p, tags: [...p.tags], complianceTags: [...p.complianceTags], testedOn: [...p.testedOn] };
}

function clonePlaybookSummary(p: PlaybookSummary): PlaybookSummary {
  return { ...p, tags: [...p.tags], complianceTags: [...p.complianceTags], testedOn: [...p.testedOn] };
}

async function loadPlaybooks(): Promise<PlaybookRecord[]> {
  try {
    return await dbQueries.getPublishedPlaybooks();
  } catch {
    console.warn('[playbooks] Database unavailable, falling back to filesystem');
    return getPublishedPlaybooksFromFs();
  }
}

export async function getPublishedPlaybooks(): Promise<PlaybookRecord[]> {
  const now = Date.now();
  if (playbooksCache.expiresAt > now) {
    return playbooksCache.playbooks.map(clonePlaybookRecord);
  }

  if (playbooksCache.pending) {
    const playbooks = await playbooksCache.pending;
    return playbooks.map(clonePlaybookRecord);
  }

  playbooksCache.pending = loadPlaybooks()
    .then((playbooks) => {
      playbooksCache.playbooks = playbooks;
      playbooksCache.playbookById = new Map(playbooks.map((p) => [p.id, p]));
      playbooksCache.expiresAt = Date.now() + CACHE_TTL_MS;
      playbooksCache.pending = null;
      return playbooks;
    })
    .catch((error) => {
      playbooksCache.pending = null;
      throw error;
    });

  const playbooks = await playbooksCache.pending;
  return playbooks.map(clonePlaybookRecord);
}

export async function getPublishedPlaybookById(id: string): Promise<PlaybookRecord | null> {
  const now = Date.now();
  if (playbooksCache.expiresAt > now) {
    const playbook = playbooksCache.playbookById.get(id);
    return playbook ? clonePlaybookRecord(playbook) : null;
  }

  await getPublishedPlaybooks();
  const playbook = playbooksCache.playbookById.get(id);
  return playbook ? clonePlaybookRecord(playbook) : null;
}

export async function getPublishedPlaybookSummaries(): Promise<PlaybookSummary[]> {
  const playbooks = await getPublishedPlaybooks();
  return playbooks.map(({ content: _content, ...summary }) => clonePlaybookSummary(summary));
}

export function getPlaybookDownloadUrl(filePath: string): string {
  return `/api/playbooks/file?path=${encodeURIComponent(filePath)}`;
}

export async function readPublishedPlaybook(filePath: string): Promise<string | null> {
  try {
    return await dbQueries.getPlaybookContent(filePath);
  } catch {
    console.warn('[playbooks] Database unavailable, falling back to filesystem');
    return readPublishedPlaybookFromFs(filePath);
  }
}

export { sanitizePublishedPath } from './playbooks-fs.ts';
