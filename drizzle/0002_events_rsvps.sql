CREATE TABLE "rsvps" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"event_id" text NOT NULL,
	"person_id" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "details" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;