DROP INDEX IF EXISTS "idx_playbooks_search";--> statement-breakpoint
ALTER TABLE "playbooks" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "playbooks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector(
  'english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(name, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(tags::text, '') || ' ' ||
  coalesce(compliance_tags::text, '')
)) STORED;--> statement-breakpoint
CREATE INDEX "idx_playbooks_search" ON "playbooks" USING gin ("search_vector");
