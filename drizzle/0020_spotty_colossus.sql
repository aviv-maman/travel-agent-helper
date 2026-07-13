CREATE TYPE "public"."commission_kind" AS ENUM('flights', 'packages', 'organized', 'custom');--> statement-breakpoint
CREATE TYPE "public"."commission_level" AS ENUM('high', 'mid', 'low', 'range', 'net');--> statement-breakpoint
CREATE TYPE "public"."contact_section" AS ENUM('general', 'sales', 'agents');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('agent-support', 'operation', 'operation-manager', 'sales-rep', 'agent');--> statement-breakpoint
CREATE TYPE "public"."note_tone" AS ENUM('muted', 'gold');--> statement-breakpoint
CREATE TYPE "public"."supplier_category" AS ENUM('flights', 'hotels', 'car-rental');--> statement-breakpoint
CREATE TABLE "airlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(48) NOT NULL,
	"iata" varchar(16),
	"flag" varchar(8),
	"name" jsonb NOT NULL,
	"kg" varchar(16) NOT NULL,
	"note" jsonb,
	"note_tone" "note_tone",
	"info" jsonb,
	"website" text NOT NULL,
	"highlight" boolean DEFAULT false NOT NULL,
	"commission" varchar(16),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer,
	"airline_id" integer,
	"section" "contact_section" NOT NULL,
	"type" "contact_type" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"phone" varchar(32) DEFAULT '' NOT NULL,
	"email" varchar(160) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contacts_owner_check" CHECK (num_nonnulls(supplier_id, airline_id) = 1)
);
--> statement-breakpoint
CREATE TABLE "supplier_cancellations" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"kind" "commission_kind" NOT NULL,
	"label" jsonb,
	"value" jsonb NOT NULL,
	"level" "commission_level" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(48) NOT NULL,
	"name" jsonb NOT NULL,
	"code" varchar(24) NOT NULL,
	"category" "supplier_category" DEFAULT 'flights' NOT NULL,
	"alias" jsonb,
	"website" text,
	"logo" text,
	"baggage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placeholder" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_id" integer NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" jsonb NOT NULL,
	"search" text DEFAULT '' NOT NULL,
	"pills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(48) NOT NULL,
	"country" jsonb NOT NULL,
	"code" varchar(2),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_airline_id_airlines_id_fk" FOREIGN KEY ("airline_id") REFERENCES "public"."airlines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_cancellations" ADD CONSTRAINT "supplier_cancellations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_commissions" ADD CONSTRAINT "supplier_commissions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_cities" ADD CONSTRAINT "transfer_cities_country_id_transfer_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."transfer_countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "airlines_slug_key" ON "airlines" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "contacts_supplier_idx" ON "contacts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "contacts_airline_idx" ON "contacts" USING btree ("airline_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_cancellations_supplier_key" ON "supplier_cancellations" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_commissions_unique" ON "supplier_commissions" USING btree ("supplier_id","kind","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_cities_unique" ON "transfer_cities" USING btree ("country_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_countries_slug_key" ON "transfer_countries" USING btree ("slug");