CREATE TYPE "public"."board_code" AS ENUM('bb', 'hb', 'fb');--> statement-breakpoint
CREATE TYPE "public"."hotel_feature" AS ENUM('pool-in', 'pool-out', 'casino', 'casino-near', 'waterpark', 'outside-center');--> statement-breakpoint
CREATE TYPE "public"."hotel_tag" AS ENUM('resort', 'kosher');--> statement-breakpoint
CREATE TYPE "public"."hotel_tier" AS ENUM('premium', 'good');--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" serial PRIMARY KEY NOT NULL,
	"iata" varchar(3) NOT NULL,
	"name" jsonb NOT NULL,
	"country" jsonb NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"info" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_distances" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" integer NOT NULL,
	"landmark_id" integer NOT NULL,
	"meters" integer,
	"walk_minutes" integer,
	"ride_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "hotel_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" integer NOT NULL,
	"feature" "hotel_feature" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" integer NOT NULL,
	"tag" "hotel_tag" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"id" serial PRIMARY KEY NOT NULL,
	"destination_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"stars" integer,
	"tier" "hotel_tier" NOT NULL,
	"boards" "board_code"[] DEFAULT '{}' NOT NULL,
	"booking_score" real,
	"google_maps_url" text,
	"booking_url" text,
	"rooms_note" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"destination_id" integer NOT NULL,
	"key" varchar(40) NOT NULL,
	"name" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"icon" varchar(16),
	"size_sqm" integer,
	"occupancy" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hotel_distances" ADD CONSTRAINT "hotel_distances_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_distances" ADD CONSTRAINT "hotel_distances_landmark_id_landmarks_id_fk" FOREIGN KEY ("landmark_id") REFERENCES "public"."landmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_features" ADD CONSTRAINT "hotel_features_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_tags" ADD CONSTRAINT "hotel_tags_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmarks" ADD CONSTRAINT "landmarks_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "destinations_iata_key" ON "destinations" USING btree ("iata");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_distances_unique" ON "hotel_distances" USING btree ("hotel_id","landmark_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_features_unique" ON "hotel_features" USING btree ("hotel_id","feature");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_tags_unique" ON "hotel_tags" USING btree ("hotel_id","tag");--> statement-breakpoint
CREATE INDEX "hotels_destination_idx" ON "hotels" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "landmarks_dest_key" ON "landmarks" USING btree ("destination_id","key");--> statement-breakpoint
CREATE INDEX "rooms_hotel_idx" ON "rooms" USING btree ("hotel_id");