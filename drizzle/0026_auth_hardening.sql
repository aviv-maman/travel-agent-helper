-- Auth hardening: TOTP encryption + replay protection + reauth

-- 1. Add replay protection: track last accepted TOTP time-step (prevents same code reuse)
ALTER TABLE "users" ADD COLUMN "totp_last_used_step" integer;

-- 2. Add reauth state: requires password/TOTP for sensitive operations
ALTER TABLE "sessions" ADD COLUMN "reauth_expires_at" timestamp with time zone;

-- 3. Email change verification: track pending email before activation
ALTER TABLE "users" ADD COLUMN "email_pending" varchar(255);
ALTER TABLE "users" ADD COLUMN "email_pending_verified_at" timestamp with time zone;

-- Indexes for efficient lookups
CREATE INDEX "users_email_pending_key" ON "users" ("email_pending") WHERE "email_pending" IS NOT NULL;
CREATE INDEX "sessions_reauth_expires_idx" ON "sessions" ("reauth_expires_at") WHERE "reauth_expires_at" IS NOT NULL;
