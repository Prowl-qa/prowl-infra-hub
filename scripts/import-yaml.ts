import { promises as fs } from 'node:fs';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from '../lib/db/schema';
import { parsePlaybookYaml, getFieldValue } from '../lib/yaml-parser';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-yaml.ts <category/file.yml>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const rootDir = process.cwd();
  const absolutePath = path.join(rootDir, filePath);
  const content = await fs.readFile(absolutePath, 'utf8');
  const filename = path.basename(filePath);
  const category = filePath.split('/')[0];

  const parsed = parsePlaybookYaml(content, filename);
  const slug = getFieldValue(content, 'name') || filename.replace(/\.yml$/, '');

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

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
      isFeatured: false,
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
        updatedAt: new Date(),
      },
    });

  console.log(`Imported: ${filePath}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
