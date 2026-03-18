import { promises as fs } from 'node:fs';
import path from 'node:path';

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

const CATEGORY_LABELS: Record<PlaybookCategory, string> = {
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

const rootDir = process.cwd();
const PLAYBOOKS_ROOT = rootDir;
const newThresholdMs = 30 * 24 * 60 * 60 * 1000;

function isPathWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function getFieldValue(content: string, key: string) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

function getInlineList(content: string, key: string): string[] {
  const match = content.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'));
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function extractSection(content: string, key: string) {
  const lines = content.split('\n');
  const section: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (!inSection) {
      if (line.startsWith(`${key}:`)) {
        inSection = true;
      }
      continue;
    }

    if (/^[a-zA-Z0-9_-]+:\s*/.test(line)) {
      break;
    }

    section.push(line);
  }

  return section;
}

function countPlaybookTasks(content: string): number {
  const playbookMatch = content.match(/^playbook:\s*\|/m);
  if (!playbookMatch) return 0;

  const playbookStart = content.indexOf(playbookMatch[0]) + playbookMatch[0].length;
  const playbookContent = content.slice(playbookStart);

  const taskLines = playbookContent.split('\n').filter((line) =>
    /^\s+- name:\s+/.test(line)
  );
  return taskLines.length;
}

function getTagValues(content: string): string[] {
  const inline = getInlineList(content, 'tags');
  if (inline.length > 0) return inline;

  const lines = extractSection(content, 'tags');
  return lines
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, '').trim())
    .filter((tag) => Boolean(tag) && !tag.startsWith('#'));
}

function toDisplayTitle(name: string, fallbackFilename: string) {
  const raw = name || fallbackFilename.replace(/\.yml$/, '');
  return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseRiskLevel(value: string): RiskLevel {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'low';
}

function parseTool(value: string): Tool {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'ansible' || normalized === 'terraform' || normalized === 'docker-compose' || normalized === 'k8s') {
    return normalized;
  }
  return 'ansible';
}

function parseCloudProvider(value: string): CloudProvider {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'aws' || normalized === 'gcp' || normalized === 'azure' || normalized === 'agnostic') {
    return normalized;
  }
  return 'agnostic';
}

function parseOsFamily(value: string): OsFamily {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'debian' || normalized === 'rhel' || normalized === 'agnostic') {
    return normalized;
  }
  return 'agnostic';
}

export async function getPublishedPlaybookSummaries(): Promise<PlaybookSummary[]> {
  const playbooks = await getPublishedPlaybooks();
  return playbooks.map(({ content: _content, ...summary }) => summary);
}

export async function getPublishedPlaybooks(): Promise<PlaybookRecord[]> {
  const playbooks: PlaybookRecord[] = [];

  for (const category of PUBLISHED_DIRS) {
    const categoryPath = path.join(PLAYBOOKS_ROOT, category);

    let files: string[] = [];
    try {
      files = await fs.readdir(categoryPath);
    } catch {
      continue;
    }

    for (const file of files.filter((entry) => entry.endsWith('.yml')).sort()) {
      const filePath = `${category}/${file}`;
      try {
        const absolutePath = path.join(PLAYBOOKS_ROOT, category, file);
        const content = await fs.readFile(absolutePath, 'utf8');
        const stats = await fs.stat(absolutePath);

        const name = getFieldValue(content, 'name');
        const description = getFieldValue(content, 'description');
        const tool = parseTool(getFieldValue(content, 'tool'));
        const cloudProvider = parseCloudProvider(getFieldValue(content, 'cloud_provider'));
        const osFamily = parseOsFamily(getFieldValue(content, 'os_family'));
        const riskLevel = parseRiskLevel(getFieldValue(content, 'risk_level'));
        const complianceTags = getInlineList(content, 'compliance_tags');
        const tags = getTagValues(content);
        const taskCount = countPlaybookTasks(content);
        const isNew = Date.now() - stats.mtimeMs <= newThresholdMs;

        playbooks.push({
          id: filePath.replace(/[/.]/g, '-'),
          title: toDisplayTitle(name, file),
          name,
          description,
          category,
          categoryLabel: CATEGORY_LABELS[category],
          filePath,
          tool,
          cloudProvider,
          osFamily,
          riskLevel,
          complianceTags,
          taskCount,
          tags,
          updatedAt: stats.mtime.toISOString(),
          isVerified: true,
          isNew,
          content,
        });
      } catch (error) {
        console.warn(`[playbooks] Skipping unreadable template "${filePath}"`, error);
      }
    }
  }

  return playbooks
    .filter((playbook) => playbook.isVerified)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function sanitizePublishedPath(rawPath: string): string | null {
  const normalized = path
    .normalize(rawPath)
    .replace(/^([.][.][/\\])+/, '')
    .replace(/^[/\\]+/, '');

  const segments = normalized.split(/[\\/]+/).filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const [category, ...rest] = segments;
  if (!PUBLISHED_DIRS.includes(category as PlaybookCategory)) {
    return null;
  }

  const resolved = path.resolve(PLAYBOOKS_ROOT, path.join(category, ...rest));
  const allowedPrefix = path.join(PLAYBOOKS_ROOT, category, path.sep);

  if (!resolved.startsWith(allowedPrefix) || path.extname(resolved) !== '.yml') {
    return null;
  }

  return resolved;
}

async function resolvePublishedPath(rawPath: string): Promise<string | null> {
  const safePath = sanitizePublishedPath(rawPath);
  if (!safePath) {
    return null;
  }

  const relativePath = path.relative(PLAYBOOKS_ROOT, safePath);
  const [category] = relativePath.split(path.sep);

  if (!category || !PUBLISHED_DIRS.includes(category as PlaybookCategory)) {
    return null;
  }

  try {
    const [realPath, realCategoryRoot] = await Promise.all([
      fs.realpath(safePath),
      fs.realpath(path.join(PLAYBOOKS_ROOT, category)),
    ]);

    if (path.extname(realPath) !== '.yml' || !isPathWithin(realCategoryRoot, realPath)) {
      return null;
    }

    return realPath;
  } catch {
    return null;
  }
}

export async function readPublishedPlaybook(rawPath: string): Promise<string | null> {
  const safePath = await resolvePublishedPath(rawPath);
  if (!safePath) {
    return null;
  }

  try {
    return await fs.readFile(safePath, 'utf8');
  } catch {
    return null;
  }
}
