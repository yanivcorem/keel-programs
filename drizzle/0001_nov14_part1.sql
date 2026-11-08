ALTER TABLE "inbound_items" ADD COLUMN "urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "startups" ADD COLUMN "stipend_advances" integer DEFAULT 0 NOT NULL;