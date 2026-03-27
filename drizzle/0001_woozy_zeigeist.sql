DROP INDEX IF EXISTS "idx_playbooks_search";--> statement-breakpoint
ALTER TABLE "playbooks" DROP COLUMN IF EXISTS "search_vector";--> statement-breakpoint
ALTER TABLE "playbooks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(name, ''))) STORED;--> statement-breakpoint
CREATE INDEX "idx_playbooks_search" ON "playbooks" USING gin ("search_vector");
