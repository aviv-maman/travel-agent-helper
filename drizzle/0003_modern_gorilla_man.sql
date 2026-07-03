CREATE TABLE "login_attempts" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
