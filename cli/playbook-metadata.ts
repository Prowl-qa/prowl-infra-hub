interface TestedOnEntry {
  os: string;
  arch: string;
}

function extractTopLevelSection(content: string, key: string): string[] {
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

function parseTestedOnEntries(content: string): TestedOnEntry[] {
  const lines = extractTopLevelSection(content, 'tested_on');
  const results: TestedOnEntry[] = [];
  let current: Partial<TestedOnEntry> = {};

  for (const line of lines) {
    const osMatch = line.match(/^\s+-?\s*os:\s*"?(.+?)"?\s*$/);
    const archMatch = line.match(/^\s+arch:\s*"?(.+?)"?\s*$/);

    if (osMatch) {
      if (current.os) {
        results.push({ os: current.os, arch: current.arch || 'x86_64' });
      }
      current = { os: osMatch[1] };
    } else if (archMatch) {
      current.arch = archMatch[1];
    }
  }

  if (current.os) {
    results.push({ os: current.os, arch: current.arch || 'x86_64' });
  }

  return results;
}

export function hasTestedOnEntry(
  content: string,
  os: string,
  arch: string
): boolean {
  return parseTestedOnEntries(content).some((entry) => entry.os === os && entry.arch === arch);
}

export function updatePlaybookYamlContent(
  content: string,
  os: string,
  arch: string
): string {
  let nextContent = content;

  if (/^tested:\s*/m.test(nextContent)) {
    nextContent = nextContent.replace(/^tested:\s*.*/m, 'tested: true');
  } else {
    nextContent = nextContent.replace(/^(playbook:\s*\|)/m, 'tested: true\n$1');
  }

  const newEntry = `  - os: "${os}"\n    arch: "${arch}"`;
  if (/^tested_on:/m.test(nextContent)) {
    if (!hasTestedOnEntry(nextContent, os, arch)) {
      nextContent = nextContent.replace(/^(tested_on:)/m, `$1\n${newEntry}`);
    }
  } else {
    nextContent = nextContent.replace(/^(tested: true)/m, `$1\ntested_on:\n${newEntry}`);
  }

  return nextContent;
}
