# 02 — Better Auth moves to the patched 1.6 line

Status: resolved
Blocked by: None — can start immediately
Target release: 0.25.0-beta (safe fixes only; a backport to 0.24 is open question 2 in the spec)

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

- Move `better-auth`, `@better-auth/core`, `@better-auth/api-key` and `@better-auth/expo` from 1.6.9 to **1.6.33**, the head of the maintained `release-1.6` line.
- Move `@better-auth/utils` from 0.4.0 to **0.4.2**. It is an exact peer of core, api-key and the drizzle adapter on both 1.6.33 and 1.7.7. Do **not** take 0.5.0: it only arrives as better-call 1.4.0's own dependency.

This fixes all nine advisories the audit reports, and an open redirect in the Expo plugin that has no advisory.

- **No schema change.** The fields of `user`, `session`, `account`, `verification` and `apikey` are identical in 1.6.9, 1.6.33 and 1.7.7, so `pnpm db:generate` must report nothing.
- **No API change** for Norish's usage.
- **Works with the `zod: 4.4.3` override.**

One behaviour changes for users, and Norish has to explain it.

- **What changed.** Since 1.6.11, account linking requires the local user's email to be verified (`accountLinking.requireLocalEmailVerified`, default true).
- **Why it hits Norish.** Norish never verifies password users' emails: it sends no verification mail. Emails are also stored encrypted, so Better Auth's own "same email → mark verified" path never fires.
- **What users see.** A password user whose first SSO login uses the same email now lands on `/auth-error?error=account_not_linked`. Already-linked accounts are unaffected.
- **What to build.**
  - Add `account_not_linked` to the known codes in `apps/web/app/(auth)/auth-error/page.tsx`, with a message telling the user to sign in with their password instead. Provide the strings in every locale.
  - Do **not** set `requireLocalEmailVerified: false`: that reopens CVE-2026-53516.

## Notes

How Norish uses Better Auth: `packages/auth/src/auth.ts` (`betterAuth({...})`, created lazily).

- **Adapter.**
  - A Drizzle adapter wrapped by `createEncryptedEmailAdapter`, which looks users up by `emailHmac`.
  - Redis `secondaryStorage` with `get`/`set`/`delete` only. Sessions, verification values and rate limits live there.
- **Sign-in methods.**
  - Optional email/password with `requireEmailVerification: false`.
  - GitHub and Google social providers.
  - OIDC through `genericOAuth` (provider id `oidc`, discovery, PKCE, a custom `getUserInfo`).
- **Account linking.** `{ enabled: true, trustedProviders: ["oidc", "google", "github"] }`.
- **Plugins.** `genericOAuth`, `apiKey`, `expo()`, `nextCookies()`.
  - Not used: admin, organization, oidcProvider, mcp, magic link, email OTP, device authorization, anonymous, SCIM.

| Advisory                                     | Requires                                      | Reachable in Norish?                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CVE-2026-53512 (critical)                    | oidcProvider or mcp plugin                    | No. Norish is an OIDC client, not a provider.                                                                                                                                                                                                                                                                                                    |
| CVE-2026-53518                               | `@better-auth/oauth-provider`                 | No; not installed.                                                                                                                                                                                                                                                                                                                               |
| **CVE-2026-53516**                           | implicit OAuth linking                        | **Yes, under conditions.** All three providers are trusted, so linking skips the email checks, and password sign-up creates unverified users. With registration open (an admin re-enabled it; it auto-closes after the first user) and password auth on, an attacker pre-registers the victim's email and captures the victim's first SSO login. |
| GHSA-9h47-pqcx-hjr4, GHSA-86j7-9j95-vpqj     | oidcProvider or mcp                           | No.                                                                                                                                                                                                                                                                                                                                              |
| CVE-2026-53514                               | organization plugin                           | No.                                                                                                                                                                                                                                                                                                                                              |
| GHSA-qq9h-g4jm-xgf3                          | magic link or email OTP                       | No.                                                                                                                                                                                                                                                                                                                                              |
| CVE-2026-45337                               | device authorization                          | No.                                                                                                                                                                                                                                                                                                                                              |
| GHSA-2vg6-77g8-24mp (low)                    | admin, anonymous or SCIM deletion             | No. Norish deletes users itself, and orphaned Redis sessions are revoked on the next request (`packages/auth/src/session.ts`).                                                                                                                                                                                                                   |
| _(no advisory)_ `@better-auth/expo` ≤ 1.6.16 | `expo()` mounted, which it is on every server | **Yes.** `GET /api/auth/expo-authorization-proxy` redirects to any `authorizationURL` and sets a signed OAuth state cookie from it: an open redirect and a login-CSRF primitive. Fixed in 1.6.17. The severity is our own assessment.                                                                                                            |

**Other 1.6.x changes:**

- **Rate limiting.** It is atomic only when the storage implements `increment`. Norish's storage stays on the old best-effort path and logs a one-time warning. That is fine for 0.25; ticket 09 adds the methods, which 1.7 requires.
- **Requests without a client IP** now share one bucket instead of being skipped. This is harmless here: Next fills `x-forwarded-for` from the socket.

**No gate type-checks this package.** `packages/auth` and apps/web set `noCheck`. Run `pnpm --filter @norish/auth exec tsc --noEmit` without `--noCheck` once before the bump and once after, and compare the two.

## Acceptance criteria

- [ ] **Versions.** The catalog has `better-auth`, `@better-auth/core`, `/api-key` and `/expo` at 1.6.33 and `@better-auth/utils` at 0.4.2. `pnpm why` shows one copy of each, with no Better Auth peer warnings.
- [ ] **Audit.** `pnpm audit` reports nothing for `better-auth`.
- [ ] **Schema.** `pnpm db:generate` produces no migration.
- [ ] **Error message.** `account_not_linked` has its own message on the auth-error page in every locale, and `pnpm i18n:check` passes.
- [ ] **Type check.** The strict `tsc` run on packages/auth shows no new errors compared with the 1.6.9 baseline.
- [ ] **Gates and E2E.** `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build` pass, and `pnpm test:e2e` passes (email sign-in, session revocation, WebSocket auth).
- [ ] **Manual smoke.** On a production Docker build with rate limiting **on** (the E2E harness sets `AUTH_RATE_LIMIT_ENABLED=false`):
  - password sign-up and sign-in;
  - OIDC first and returning login, including claim mapping;
  - GitHub and Google;
  - a password user's first SSO login with the same email shows the new message;
  - an API key via `x-api-key` works on REST and the WebSocket;
  - the 4th sign-in within 10 s gets a 429;
  - existing sessions survive the upgrade.
- [ ] **Release notes.** A security-update bullet under `## Fixes and Improvements`, and an `## Upgrade notes` entry: "A password account and an SSO login with the same email are no longer linked automatically; sign in with your password." No environment change, no migration, no re-login.

## Comments

- Filed 2026-10-12 with the spec. Sources:
  - better-auth 1.6.9, 1.6.10, 1.6.11, 1.6.17, 1.6.18, 1.6.33 and 1.7.7;
  - @better-auth/core, api-key and drizzle-adapter 1.6.9, 1.6.33 and 1.7.7;
  - @better-auth/expo 1.6.9 to 1.6.33 and 1.7.7;
  - @better-auth/utils 0.4.0, 0.4.2 and 0.5.0;
  - `npm audit` on scratch probes for 1.6.9, 1.6.33 and 1.7.7 (the last two report 0 advisories).
- 2026-10-13 — Shipped in 0.25.0 (c7627004, 19b94609, 888000a8; PR #617). The `account_not_linked` copy is "This email is already in use.", not the wording above, and the encrypted-email adapter now returns the decrypted user.
