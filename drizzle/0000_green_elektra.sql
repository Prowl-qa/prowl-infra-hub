CREATE TABLE "playbooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"file_path" varchar(255) NOT NULL,
	"tool" varchar(50) NOT NULL,
	"cloud_provider" varchar(50) NOT NULL,
	"os_family" varchar(50) NOT NULL,
	"risk_level" varchar(10) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compliance_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"playbook" text NOT NULL,
	"content" text NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"tested" boolean DEFAULT false NOT NULL,
	"tested_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"test_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" text,
	CONSTRAINT "playbooks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "playbooks_file_path_unique" UNIQUE("file_path")
);
--> statement-breakpoint
CREATE INDEX "idx_playbooks_category" ON "playbooks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_playbooks_tool" ON "playbooks" USING btree ("tool");--> statement-breakpoint
CREATE INDEX "idx_playbooks_cloud_provider" ON "playbooks" USING btree ("cloud_provider");--> statement-breakpoint
CREATE INDEX "idx_playbooks_risk_level" ON "playbooks" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_playbooks_is_featured" ON "playbooks" USING btree ("is_featured") WHERE is_featured = true;