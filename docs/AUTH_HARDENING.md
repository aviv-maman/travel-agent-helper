# Auth Hardening: Breaking Changes & Setup Guide

## Overview

This document covers auth system changes that introduce new requirements and breaking behavior.

## 1. TOTP Secret Encryption (BREAKING)

**What changed:** TOTP secrets are now encrypted at rest using AES-256-GCM.

**Impact:**
- Existing TOTP secrets in the database are stored as plain Base32 strings
- New secrets created after this change will be stored encrypted
- Mixed state is handled: system detects plain vs encrypted and processes accordingly

**Setup required:**
```bash
# Generate a random 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env.local (dev) or environment (production)
TOTP_ENC_KEY="<base64-encoded-32-bytes>"
```

**Future work:** Migrate existing plain secrets to encrypted format (optional backfill).

---

## 2. TOTP Replay Protection

**What changed:** TOTP codes within the same 30-second window are rejected after first use.

**Impact:**
- Users cannot reuse the same 6-digit code if they enter it twice quickly
- New column: `users.totp_last_used_step` tracks the last accepted time-step
- Automatic on login, 2FA disable, password reset flows

**No action needed:** Transparent to users.

---

## 3. Reauth/"Sudo Mode" for Sensitive Operations

**What changed:** Sensitive operations now require recent password/TOTP verification.

**Affected operations:**
- ✅ Passkey registration (`passkeyRegistrationVerify`)
- ✅ Passkey deletion (`deletePasskeyAction`)
- ✅ Account deletion (`deleteMyAccount`)

**Response codes:**
- `reauth_required` — user must verify password or TOTP first
- `ok` — operation succeeded

**Frontend requirements:**
You need to add a **reauth modal/flow** that:
1. Checks if user has password → show password input
2. Else if 2FA enabled → show TOTP input
3. Else if only OAuth → redirect to login (edge case)
4. Calls `reauthWithPassword()` or `reauthWithTotp()` (to be wired up)
5. Reauth window lasts 5 minutes
6. After verification, retry the original operation

**Status:** Reauth gate is in place, but the verification actions (`reauthWithPassword`, `reauthWithTotp`) are skeleton functions in `lib/auth/reauth.ts` that need wiring to server actions.

---

## 4. Email Verification on Change (BREAKING)

**What changed:** Changing email now requires verification of the new address.

**Workflow:**
1. User submits new email → stored in `users.email_pending` (not active yet)
2. Verification link sent to new email
3. Link expires in 24 hours
4. Only after clicking link does email become active

**Impact:**
- Prevents typos from silently becoming recovery addresses
- Prevents attackers from hijacking email without user confirmation
- Users must verify email change to complete it

**Database columns:**
- `users.email_pending` — the new email address awaiting verification
- `users.email_pending_verified_at` — when verification was confirmed

**Email token type added:**
- New enum value: `email_change` (24-hour TTL)

**Backend template required:**
The backend needs a new email template: `email_change_verification` (sends verification link).

**Status:** Frontend actions are ready (`requestEmailChange`, `confirmEmailChange`), but backend email template needs to be created.

---

## 5. Session Renewal

**What changed:** Sessions automatically extend when >50% expired.

**Behavior:**
- 30-day session duration
- When session reaches 15 days old, it auto-renews to a fresh 30 days
- Active users never need to manually re-login
- Renewal is transparent and happens in `validateSession()`

**Impact:**
- Users with regular activity stay signed in indefinitely (up to token rotation)
- No UX change needed

**No action needed:** Fully automatic.

---

## Database Migration

Migration `0026_auth_hardening.sql` adds:
```sql
ALTER TABLE "users" ADD COLUMN "totp_last_used_step" integer;
ALTER TABLE "sessions" ADD COLUMN "reauth_expires_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "email_pending" varchar(255);
ALTER TABLE "users" ADD COLUMN "email_pending_verified_at" timestamp with time zone;
```

Run: `npm run db:migrate`

---

## Checklist: What Still Needs to Be Done

- [ ] Set `TOTP_ENC_KEY` environment variable
- [ ] Create/test "Reauth" modal UI for sensitive operations
- [ ] Wire up `reauthWithPassword()` and `reauthWithTotp()` to server actions
- [ ] Backend: Create `email_change_verification` email template
- [ ] Test email change flow end-to-end
- [ ] (Optional) Backfill existing TOTP secrets to encrypted format
- [ ] (Optional) Migrate passwords from scrypt to Argon2id (future)

---

## Testing

**TOTP Encryption:**
```bash
# Verify TOTP_ENC_KEY is set
echo $TOTP_ENC_KEY

# Test 2FA enable/disable flow
```

**Reauth:**
```bash
# Should return reauth_required
POST /api/passkeys/register (without reauth)

# After reauth, should succeed
POST /api/auth/reauth (with password or TOTP)
POST /api/passkeys/register (retry)
```

**Email Change:**
```bash
# Request email change
POST /api/auth/email/change-request { email: "new@example.com" }

# Verify link in email
GET /verify-email-change?token=<token>
```

---

## Breaking Changes Summary

| Feature | Old Behavior | New Behavior |
|---------|--------------|--------------|
| TOTP secrets | Plain text in DB | Encrypted at rest |
| TOTP reuse | Same code in same window allowed | Rejected (replay protection) |
| Email change | Immediate | Requires verification link |
| Sensitive ops | No reauth required | Requires password/TOTP |
| Sessions | Expire at 30 days | Auto-renew past 15 days |

---

## Rollback Plan

To rollback if issues arise:
1. Revert commits: `9f5b796` and `0758fb5`
2. Drop migration `0026_auth_hardening.sql`
3. Remove `TOTP_ENC_KEY` from environment
4. This restores old behavior completely

However, you'll need to:
- Decrypt existing TOTP secrets if any were encrypted
- Handle mixed plain/encrypted secrets in the codebase
