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
}

export interface PlaybookRecord extends PlaybookSummary {
  content: string;
}

import * as dbQueries from '@/lib/db/queries';
import {
  getPublishedPlaybooksFromFs,
  getPublishedPlaybookSummariesFromFs,
  readPublishedPlaybookFromFs,
} from '@/lib/playbooks-fs';

export async function getPublishedPlaybooks(): Promise<PlaybookRecord[]> {
  try {
    return await dbQueries.getPublishedPlaybooks();
  } catch {
    console.warn('[playbooks] Database unavailable, falling back to filesystem');
    return getPublishedPlaybooksFromFs();
  }
}

export async function getPublishedPlaybookSummaries(): Promise<PlaybookSummary[]> {
  try {
    return await dbQueries.getPublishedPlaybookSummaries();
  } catch {
    console.warn('[playbooks] Database unavailable, falling back to filesystem');
    return getPublishedPlaybookSummariesFromFs();
  }
}

export async function readPublishedPlaybook(filePath: string): Promise<string | null> {
  try {
    return await dbQueries.getPlaybookContent(filePath);
  } catch {
    console.warn('[playbooks] Database unavailable, falling back to filesystem');
    return readPublishedPlaybookFromFs(filePath);
  }
}

export { sanitizePublishedPath } from '@/lib/playbooks-fs';
