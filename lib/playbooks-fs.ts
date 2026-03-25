import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { PlaybookCategory, PlaybookSummary, PlaybookRecord } from './playbooks.ts';

const PUBLISHED_DIRS = ['patching', 'provisioning', 'security', 'monitoring', 'containers', 'networking', 'backup', 'configuration', 'ci-cd'] as const;

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
      if (line.startsWith(`${key}:`)) inSection = true;
      continue;
    }
    if (/^[a-zA-Z0-9_-]+:\s*/.test(line)) break;
    section.push(line);
  }
  return section;
}

function countPlaybookTasks(content: string): number {
  const playbookMatch = content.match(/^playbook:\s*\|/m);
  if (!playbookMatch) return 0;
  const playbookStart = content.indexOf(playbookMatch[0]) + playbookMatch[0].length;
  const playbookContent = content.slice(playbookStart);
  return playbookContent.split('\n').filter((line) => /^\s+- name:\s+/.test(line)).length;
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

const UPPERCASE_WORDS = new Set([
  'aws', 'gcp', 'ssh', 'os', 'ssl', 'tls', 'dns', 'http', 'https', 'api',
  'cpu', 'ram', 'vm', 'vpc', 'iam', 'rds', 'ec2', 's3', 'ebs', 'elb', 'alb',
  'nlb', 'ecs', 'eks', 'ecr', 'gke', 'aks', 'ci', 'cd', 'ip', 'tcp', 'udp', 'nfs',
  'lvm', 'raid', 'sql', 'db', 'vpn', 'mfa', 'rbac', 'acl', 'cis', 'pci',
  'soc', 'hipaa', 'ntp', 'smtp', 'ldap', 'sso', 'jwt', 'k8s',
]);

function toDisplayTitle(name: string, fallbackFilename: string) {
  const raw = name || fallbackFilename.replace(/\.yml$/, '');
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .split(' ')
    .map((word) => (UPPERCASE_WORDS.has(word.toLowerCase()) ? word.toUpperCase() : word))
    .join(' ');
}

type RiskLevel = 'low' | 'medium' | 'high';
type Tool = 'ansible' | 'terraform' | 'docker-compose' | 'k8s';
type CloudProvider = 'aws' | 'gcp' | 'azure' | 'agnostic';
type OsFamily = 'debian' | 'rhel' | 'agnostic';

function parseRiskLevel(v: string): RiskLevel {
  const n = v.toLowerCase().trim();
  return n === 'low' || n === 'medium' || n === 'high' ? n : 'low';
}
function parseTool(v: string): Tool {
  const n = v.toLowerCase().trim();
  return n === 'ansible' || n === 'terraform' || n === 'docker-compose' || n === 'k8s' ? n : 'ansible';
}
function parseCloudProvider(v: string): CloudProvider {
  const n = v.toLowerCase().trim();
  return n === 'aws' || n === 'gcp' || n === 'azure' || n === 'agnostic' ? n : 'agnostic';
}
function parseOsFamily(v: string): OsFamily {
  const n = v.toLowerCase().trim();
  return n === 'debian' || n === 'rhel' || n === 'agnostic' ? n : 'agnostic';
}

export async function getPublishedPlaybooksFromFs(): Promise<PlaybookRecord[]> {
  const playbooks: PlaybookRecord[] = [];

  for (const category of PUBLISHED_DIRS) {
    const categoryPath = path.join(PLAYBOOKS_ROOT, category);
    let files: string[] = [];
    try {
      files = await fs.readdir(categoryPath);
    } catch {
      continue;
    }

    for (const file of files.filter((e) => e.endsWith('.yml')).sort()) {
      const filePath = `${category}/${file}`;
      try {
        const absolutePath = path.join(PLAYBOOKS_ROOT, category, file);
        const content = await fs.readFile(absolutePath, 'utf8');
        const stats = await fs.stat(absolutePath);
        const name = getFieldValue(content, 'name');

        playbooks.push({
          id: filePath.replace(/[/.]/g, '-'),
          title: toDisplayTitle(name, file),
          name,
          description: getFieldValue(content, 'description'),
          category,
          categoryLabel: CATEGORY_LABELS[category],
          filePath,
          tool: parseTool(getFieldValue(content, 'tool')),
          cloudProvider: parseCloudProvider(getFieldValue(content, 'cloud_provider')),
          osFamily: parseOsFamily(getFieldValue(content, 'os_family')),
          riskLevel: parseRiskLevel(getFieldValue(content, 'risk_level')),
          complianceTags: getInlineList(content, 'compliance_tags'),
          taskCount: countPlaybookTasks(content),
          tags: getTagValues(content),
          updatedAt: stats.mtime.toISOString(),
          isVerified: true,
          isNew: Date.now() - stats.mtimeMs <= newThresholdMs,
          tested: false,
          testedOn: [],
          content,
        });
      } catch (error) {
        console.warn(`[playbooks] Skipping unreadable template "${filePath}"`, error);
      }
    }
  }

  return playbooks
    .filter((p) => p.isVerified)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPublishedPlaybookSummariesFromFs(): Promise<PlaybookSummary[]> {
  const playbooks = await getPublishedPlaybooksFromFs();
  return playbooks.map(({ content: _content, ...summary }) => summary);
}

export function sanitizePublishedPath(rawPath: string): string | null {
  const normalized = path
    .normalize(rawPath)
    .replace(/^([.][.][/\\])+/, '')
    .replace(/^[/\\]+/, '');

  const segments = normalized.split(/[\\/]+/).filter(Boolean);
  if (segments.length < 2) return null;

  const [category, ...rest] = segments;
  if (!PUBLISHED_DIRS.includes(category as PlaybookCategory)) return null;

  const resolved = path.resolve(PLAYBOOKS_ROOT, path.join(category, ...rest));
  const allowedPrefix = path.join(PLAYBOOKS_ROOT, category, path.sep);
  if (!resolved.startsWith(allowedPrefix) || path.extname(resolved) !== '.yml') return null;

  return resolved;
}

function isPathWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function readPublishedPlaybookFromFs(rawPath: string): Promise<string | null> {
  const normalized = path
    .normalize(rawPath)
    .replace(/^([.][.][/\\])+/, '')
    .replace(/^[/\\]+/, '');

  const segments = normalized.split(/[\\/]+/).filter(Boolean);
  if (segments.length < 2) return null;

  const [category, ...rest] = segments;
  if (!PUBLISHED_DIRS.includes(category as PlaybookCategory)) return null;

  const resolved = path.resolve(PLAYBOOKS_ROOT, path.join(category, ...rest));
  const allowedPrefix = path.join(PLAYBOOKS_ROOT, category, path.sep);
  if (!resolved.startsWith(allowedPrefix) || path.extname(resolved) !== '.yml') return null;

  try {
    const [realPath, realCategoryRoot] = await Promise.all([
      fs.realpath(resolved),
      fs.realpath(path.join(PLAYBOOKS_ROOT, category)),
    ]);
    if (path.extname(realPath) !== '.yml' || !isPathWithin(realCategoryRoot, realPath)) return null;
    return await fs.readFile(realPath, 'utf8');
  } catch {
    return null;
  }
}
