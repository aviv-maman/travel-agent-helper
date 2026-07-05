CREATE TABLE "saved_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"image_key" text,
	"image_media_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_quotes" ADD CONSTRAINT "saved_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_quotes_user_created_idx" ON "saved_quotes" USING btree ("user_id","created_at");