ALTER TABLE "airlines" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "airlines" ADD COLUMN "custom" boolean DEFAULT false NOT NULL;