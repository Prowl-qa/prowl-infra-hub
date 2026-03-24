import type { RiskLevel, Tool, CloudProvider, OsFamily } from '@/lib/playbooks';

export function getFieldValue(content: string, key: string): string {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

export function getInlineList(content: string, key: string): string[] {
  const match = content.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'));
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function extractSection(content: string, key: string): string[] {
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

export function getTagValues(content: string): string[] {
  const inline = getInlineList(content, 'tags');
  if (inline.length > 0) return inline;

  const lines = extractSection(content, 'tags');
  return lines
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, '').trim())
    .filter((tag) => Boolean(tag) && !tag.startsWith('#'));
}

export function countPlaybookTasks(content: string): number {
  const playbookMatch = content.match(/^playbook:\s*\|/m);
  if (!playbookMatch) return 0;

  const playbookStart = content.indexOf(playbookMatch[0]) + playbookMatch[0].length;
  const playbookContent = content.slice(playbookStart);

  const taskLines = playbookContent.split('\n').filter((line) =>
    /^\s+- name:\s+/.test(line)
  );
  return taskLines.length;
}

const UPPERCASE_WORDS = new Set([
  'aws', 'gcp', 'ssh', 'os', 'ssl', 'tls', 'dns', 'http', 'https', 'api',
  'cpu', 'ram', 'vm', 'vpc', 'iam', 'rds', 'ec2', 's3', 'ebs', 'elb', 'alb',
  'nlb', 'ecs', 'eks', 'ecr', 'gke', 'aks', 'ci', 'cd', 'ip', 'tcp', 'udp', 'nfs',
  'lvm', 'raid', 'sql', 'db', 'vpn', 'mfa', 'rbac', 'acl', 'cis', 'pci',
  'soc', 'hipaa', 'ntp', 'smtp', 'ldap', 'sso', 'jwt', 'k8s',
]);

export function toDisplayTitle(name: string, fallbackFilename: string): string {
  const raw = name || fallbackFilename.replace(/\.yml$/, '');
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .split(' ')
    .map((word) => (UPPERCASE_WORDS.has(word.toLowerCase()) ? word.toUpperCase() : word))
    .join(' ');
}

export function parseRiskLevel(value: string): RiskLevel {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'low';
}

export function parseTool(value: string): Tool {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'ansible' || normalized === 'terraform' || normalized === 'docker-compose' || normalized === 'k8s') {
    return normalized;
  }
  return 'ansible';
}

export function parseCloudProvider(value: string): CloudProvider {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'aws' || normalized === 'gcp' || normalized === 'azure' || normalized === 'agnostic') {
    return normalized;
  }
  return 'agnostic';
}

export function parseOsFamily(value: string): OsFamily {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'debian' || normalized === 'rhel' || normalized === 'agnostic') {
    return normalized;
  }
  return 'agnostic';
}

export function getVarsSection(content: string): Record<string, string> {
  const lines = extractSection(content, 'vars');
  const vars: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^\s+(\w+):\s*"?(.+?)"?\s*$/);
    if (match) {
      vars[match[1]] = match[2];
    }
  }
  return vars;
}

export function getPlaybookBlock(content: string): string {
  const match = content.match(/^playbook:\s*\|\n([\s\S]*)$/m);
  if (!match) return '';
  return match[1];
}

export interface ParsedPlaybook {
  name: string;
  title: string;
  description: string;
  tags: string[];
  tool: Tool;
  cloudProvider: CloudProvider;
  osFamily: OsFamily;
  riskLevel: RiskLevel;
  complianceTags: string[];
  vars: Record<string, string>;
  playbook: string;
  taskCount: number;
  tested: boolean;
  testedOn: Array<{ os: string; arch: string }>;
}

export function parseTestedOn(content: string): Array<{ os: string; arch: string }> {
  const lines = extractSection(content, 'tested_on');
  const results: Array<{ os: string; arch: string }> = [];
  let current: Partial<{ os: string; arch: string }> = {};
  for (const line of lines) {
    const osMatch = line.match(/^\s+-?\s*os:\s*"?(.+?)"?\s*$/);
    const archMatch = line.match(/^\s+arch:\s*"?(.+?)"?\s*$/);
    if (osMatch) {
      if (current.os) results.push({ os: current.os, arch: current.arch || 'x86_64' });
      current = { os: osMatch[1] };
    } else if (archMatch) {
      current.arch = archMatch[1];
    }
  }
  if (current.os) results.push({ os: current.os, arch: current.arch || 'x86_64' });
  return results;
}

export function parsePlaybookYaml(content: string, filename: string): ParsedPlaybook {
  const name = getFieldValue(content, 'name');
  const testedValue = getFieldValue(content, 'tested');
  return {
    name,
    title: toDisplayTitle(name, filename),
    description: getFieldValue(content, 'description'),
    tags: getTagValues(content),
    tool: parseTool(getFieldValue(content, 'tool')),
    cloudProvider: parseCloudProvider(getFieldValue(content, 'cloud_provider')),
    osFamily: parseOsFamily(getFieldValue(content, 'os_family')),
    riskLevel: parseRiskLevel(getFieldValue(content, 'risk_level')),
    complianceTags: getInlineList(content, 'compliance_tags'),
    vars: getVarsSection(content),
    playbook: getPlaybookBlock(content),
    taskCount: countPlaybookTasks(content),
    tested: testedValue === 'true',
    testedOn: parseTestedOn(content),
  };
}
