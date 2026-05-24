ALTER TABLE "playbooks" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "playbooks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector(
  'english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(name, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(tags::text, '') || ' ' ||
  coalesce(compliance_tags::text, '')
)) STORED;