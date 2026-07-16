ALTER TABLE "hotels" ADD COLUMN "google_place_id" varchar(128);--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "google_rating" real;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "google_review_count" integer;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "places_updated_at" timestamp with time zone;