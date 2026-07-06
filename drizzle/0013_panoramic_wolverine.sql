CREATE TABLE "exchange_rates" (
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_base_quote_pk" PRIMARY KEY("base","quote")
);
