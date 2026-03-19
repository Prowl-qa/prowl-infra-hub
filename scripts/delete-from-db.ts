import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from '../lib/db/schema';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/delete-from-db.ts <category/file.yml>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  const result = await db
    .delete(schema.playbooks)
    .where(eq(schema.playbooks.filePath, filePath))
    .returning({ id: schema.playbooks.id, slug: schema.playbooks.slug });

  if (result.length > 0) {
    console.log(`Deleted: ${filePath} (slug: ${result[0].slug})`);
  } else {
    console.log(`Not found in database: ${filePath}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Delete failed:', err);
  process.exit(1);
});
