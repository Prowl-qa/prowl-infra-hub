import {
  customType,
  pgTable,
  serial,
  varchar,
  text,
  jsonb,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

const playbooksSearchVectorSql = sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(name, ''))`;

export const playbooks = pgTable(
  'playbooks',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    filePath: varchar('file_path', { length: 255 }).notNull().unique(),
    tool: varchar('tool', { length: 50 }).notNull(),
    cloudProvider: varchar('cloud_provider', { length: 50 }).notNull(),
    osFamily: varchar('os_family', { length: 50 }).notNull(),
    riskLevel: varchar('risk_level', { length: 10 }).notNull(),
    tags: jsonb('tags').notNull().$type<string[]>().default([]),
    complianceTags: jsonb('compliance_tags').notNull().$type<string[]>().default([]),
    vars: jsonb('vars').notNull().$type<Record<string, string>>().default({}),
    playbook: text('playbook').notNull(),
    content: text('content').notNull(),
    taskCount: integer('task_count').notNull().default(0),
    isVerified: boolean('is_verified').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    tested: boolean('tested').notNull().default(false),
    testedOn: jsonb('tested_on').notNull().$type<Array<{ os: string; arch: string }>>().default([]),
    testResults: jsonb('test_results').notNull().$type<Array<{ os: string; passed: boolean; date: string }>>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    searchVector: tsvector('search_vector').generatedAlwaysAs(playbooksSearchVectorSql),
  },
  (table) => [
    index('idx_playbooks_category').on(table.category),
    index('idx_playbooks_tool').on(table.tool),
    index('idx_playbooks_cloud_provider').on(table.cloudProvider),
    index('idx_playbooks_risk_level').on(table.riskLevel),
    index('idx_playbooks_is_featured').on(table.isFeatured).where(sql`is_featured = true`),
    index('idx_playbooks_search').using('gin', table.searchVector),
  ]
);

export type Playbook = typeof playbooks.$inferSelect;
export type NewPlaybook = typeof playbooks.$inferInsert;
