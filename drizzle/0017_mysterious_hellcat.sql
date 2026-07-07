CREATE TYPE "public"."dashboard_task_status" AS ENUM('open', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."dashboard_task_type" AS ENUM('task', 'awaiting_supplier', 'client_followup', 'reminder');--> statement-breakpoint
CREATE TABLE "dashboard_scratchpad" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_settings" (
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	CONSTRAINT "dashboard_settings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "dashboard_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"client_name" text,
	"client_phone" text,
	"type" "dashboard_task_type" NOT NULL,
	"supplier_name" text,
	"due_date" date,
	"notes" text,
	"status" "dashboard_task_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dashboard_scratchpad" ADD CONSTRAINT "dashboard_scratchpad_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_settings" ADD CONSTRAINT "dashboard_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_tasks" ADD CONSTRAINT "dashboard_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_tasks_user_status_idx" ON "dashboard_tasks" USING btree ("user_id","status");