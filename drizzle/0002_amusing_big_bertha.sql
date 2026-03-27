CREATE INDEX IF NOT EXISTS "idx_playbooks_tags" ON "playbooks" USING gin ("tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_playbooks_compliance_tags" ON "playbooks" USING gin ("compliance_tags");
