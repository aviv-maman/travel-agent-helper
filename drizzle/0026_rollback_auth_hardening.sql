-- Rollback auth hardening migration (remove unused columns)
ALTER TABLE "user" DROP COLUMN IF EXISTS "totpLastUsedStep";
ALTER TABLE "user" DROP COLUMN IF EXISTS "reauthExpiresAt";
ALTER TABLE "user" DROP COLUMN IF EXISTS "emailPending";
ALTER TABLE "user" DROP COLUMN IF EXISTS "emailPendingVerifiedAt";

-- Remove "email_change" from emailTokenKind enum (recreate the enum without it)
ALTER TYPE "emailTokenKind" RENAME TO "emailTokenKind_old";
CREATE TYPE "emailTokenKind" AS ENUM ('email_verification', 'password_reset', 'invite');
ALTER TABLE "emailToken" ALTER COLUMN "kind" TYPE "emailTokenKind" USING "kind"::text::"emailTokenKind";
DROP TYPE "emailTokenKind_old";
