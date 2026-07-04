CREATE TYPE "public"."ai_provider" AS ENUM('anthropic');--> statement-breakpoint
CREATE TABLE "user_ai_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"last4" varchar(4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ai_credentials" ADD CONSTRAINT "user_ai_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_ai_credentials_user_provider_key" ON "user_ai_credentials" USING btree ("user_id","provider");