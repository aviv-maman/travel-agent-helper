CREATE TABLE "quote_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" varchar(64) NOT NULL,
	"name_he" varchar(64) DEFAULT '' NOT NULL,
	"baggage_suitcase" varchar(32),
	"baggage_trolley" varchar(32),
	"net_flight_no_star" varchar(8),
	"net_flight_star" varchar(8),
	"net_package_no_star" varchar(8),
	"net_package_star" varchar(8),
	"notes" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
