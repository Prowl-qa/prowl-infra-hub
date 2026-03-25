import { promises as fs } from 'node:fs';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from '../lib/db/schema';
import {
  parsePlaybookYaml,
  getFieldValue,
} from '../lib/yaml-parser';

const PUBLISHED_DIRS = [
  'patching',
  'provisioning',
  'security',
  'monitoring',
  'containers',
  'networking',
  'backup',
  'configuration',
  'ci-cd',
];

const FEATURED_PLAYBOOKS = [
  'patching/rolling-os-update.yml',
  'security/ssh-hardening.yml',
  'monitoring/install-node-exporter.yml',
  'provisioning/aws-vpc-setup.yml',
  'containers/k8s-namespace-setup.yml',
  'backup/database-backup-s3.yml',
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  // Create JSONB GIN indexes that are still managed via raw SQL.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_playbooks_tags ON playbooks USING GIN (tags);
    CREATE INDEX IF NOT EXISTS idx_playbooks_compliance_tags ON playbooks USING GIN (compliance_tags);
  `);

  const rootDir = process.cwd();
  let total = 0;
  let errors = 0;

  for (const category of PUBLISHED_DIRS) {
    const categoryPath = path.join(rootDir, category);

    let files: string[];
    try {
      files = await fs.readdir(categoryPath);
    } catch {
      continue;
    }

    const ymlFiles = files.filter((f) => f.endsWith('.yml')).sort();

    for (const file of ymlFiles) {
      const filePath = `${category}/${file}`;
      try {
        const absolutePath = path.join(categoryPath, file);
        const content = await fs.readFile(absolutePath, 'utf8');
        const parsed = parsePlaybookYaml(content, file);
        const slug = getFieldValue(content, 'name') || file.replace(/\.yml$/, '');

        await db
          .insert(schema.playbooks)
          .values({
            slug,
            name: parsed.name,
            title: parsed.title,
            description: parsed.description,
            category,
            filePath,
            tool: parsed.tool,
            cloudProvider: parsed.cloudProvider,
            osFamily: parsed.osFamily,
            riskLevel: parsed.riskLevel,
            tags: parsed.tags,
            complianceTags: parsed.complianceTags,
            vars: parsed.vars,
            playbook: parsed.playbook,
            content,
            taskCount: parsed.taskCount,
            isVerified: true,
            isFeatured: FEATURED_PLAYBOOKS.includes(filePath),
            tested: false,
            testedOn: [],
            testResults: [],
          })
          .onConflictDoUpdate({
            target: schema.playbooks.filePath,
            set: {
              slug,
              name: parsed.name,
              title: parsed.title,
              description: parsed.description,
              category,
              filePath,
              tool: parsed.tool,
              cloudProvider: parsed.cloudProvider,
              osFamily: parsed.osFamily,
              riskLevel: parsed.riskLevel,
              tags: parsed.tags,
              complianceTags: parsed.complianceTags,
              vars: parsed.vars,
              playbook: parsed.playbook,
              content,
              taskCount: parsed.taskCount,
              isFeatured: FEATURED_PLAYBOOKS.includes(filePath),
              updatedAt: new Date(),
            },
          });

        total++;
        console.log(`  [ok] ${filePath}`);
      } catch (err) {
        errors++;
        console.error(`  [FAIL] ${filePath}:`, err);
      }
    }
  }

  console.log(`\nSeeded ${total} playbooks (${errors} errors)`);

  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
