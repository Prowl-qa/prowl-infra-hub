import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface TestReport {
  playbook: string;
  tool: string;
  testedOn: { os: string; arch: string };
  passed: boolean;
  date: string;
  duration_ms: number;
  error?: string;
}

export async function writeReport(report: TestReport, outputDir: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });

  const slug = report.playbook
    .replace(/[/\\]/g, '-')
    .replace(/\.yml$/, '');
  const filename = `${slug}-${report.testedOn.os}-${Date.now()}.json`;
  const filePath = path.join(outputDir, filename);

  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}
