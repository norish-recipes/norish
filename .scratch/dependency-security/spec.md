# Dependency security: 0.25.0 patches, 0.26.0 sweep

Status: superseded

The 0.25.0 half (tickets 01–04) shipped in PR #617. The 0.26.0 half (05–09) is superseded by `.scratch/dependency-upgrades/` as of 2026-10-13.

## Problem Statement

Dependabot flags two critical advisories in what Norish ships: Next.js 16.3.2 (unauthenticated RCE through the image optimizer, GHSA-2xp9-vwfh-vxw4, plus two that do not reach us) and Better Auth 1.6.9 (account takeover through OAuth auto-linking, GHSA-g38m-r43w-p2q7, plus six in plugins we do not use). The production image is `node:22-alpine3.21`, a tag upstream stopped rebuilding on 2025-10-30: production runs Node 22.21.1, a year of Node security releases behind `.nvmrc`, on an Alpine that leaves support on 2026-11-01. `pnpm audit` lists 18 critical and 108 high findings in all, most through `apps/mobile`, test tooling and lint tooling.

## Solution

Two releases.

**0.25.0-beta** (shipping now, PR #617) takes the smallest change that closes what reaches a self-hoster: the newest patch of the current lines (next 16.3.8, better-auth 1.6.33), the same Node major on a maintained Alpine (`node:22-alpine3.24`), the two remaining criticals, and a release-notes Security section that says upgrade now.

**0.26.0-beta** (there is no 0.25.1) moves everything to latest, breaking majors included: Node 26, better-auth 1.7, bullmq 6, ioredis 6, pnpm 11 and the rest. Every breaking change lands with no manual step for self-hosters; what genuinely cannot be automatic gets an Upgrade notes line.

## Implementation Decisions

**Patch lines only in 0.25.0.** better-auth 1.7 moves the OIDC callback and re-keys accounts, so it waits for 0.26.0. `@better-auth/{core,api-key,expo}` move to 1.6.33 with it; 1.6.33 pins `@better-auth/utils` 0.4.2.

**First SSO sign-in of a password user is refused, on purpose.** Since 1.6.11 Better Auth links an OAuth identity to an existing account only when the local account's email is verified, and `trustedProviders` no longer bypasses that. Norish has no mail channel, so a password account is never verified. Marking emails verified, or setting the deprecated `requireLocalEmailVerified: false`, reopens the takeover: "verified" is the only claim that the account's creator owns the address. So the refusal stays, and the auth-error page says only that the email is already in use (`account_not_linked`). There is no in-app link-a-provider setting; that was left out deliberately.

**The encrypted-email adapter must return the real email.** `createEncryptedEmailAdapter` (`packages/auth/src/auth.ts`) maps email lookups to `emailHmac` but hands Better Auth the encrypted row, so Better Auth's "provider email equals account email" check never matches and an OAuth sign-in never marks a user verified. Decrypting the row it returns fixes that: a user who linked Google is marked verified at their next Google sign-in, after which OIDC auto-links as before.

**0.26 stops auto-linking altogether** (noted 2026-10-15). Better Auth 1.7's `disableImplicitLinking` is on, so no sign-in links accounts, verified or not (`.scratch/dependency-upgrades/` ticket 10). Adding a provider will be linking it from a signed-in session in Settings, a later feature of its own.

**The image stays on Node 22 in 0.25.0.** `node:22-alpine3.24`, `.nvmrc` 22.23.3. Node 26 (LTS from 2026-10-28, supported to April 2029) is 0.26.0's.

**"Latest" in 0.26.0 stops at real blockers only.** TypeScript 7, ESLint 10 and zod-openapi 6 were held for peer ranges (see the August sweep); each comes along if its blocker has moved, else stays held with the reason written in its ticket.

**No manual steps for 0.26.0's breaking changes.** The registered OIDC callback keeps working; the `(issuer, accountId)` backfill and the swap from BullMQ repeatables to Job Schedulers run at boot, beside the existing backfills in `packages/api/src/startup/`.

**Findings fixed by upgrade first, then `pnpm.overrides`** for transitive packages whose parent has no fixed release. No audit gate in CI: an advisory published overnight would turn every PR red.

## Known gaps

- A user who has only ever signed in with a password cannot move to SSO under the same email. Linking them safely needs a mail channel or linking from a signed-in session; neither is planned.
- `apps/mobile` findings stay. Mobile is parked pending a rewrite and no gate reaches it; 0.26.0's ticket 09 lists the accepted entries.

## Testing Decisions

Every ticket ends on the `CONTRIBUTING.md` gates plus `pnpm deps:cycles` and `pnpm format:check`, which CI runs and the local gates do not. Auth changes run the auth E2E specs. Image changes are verified by building the image and booting it against Postgres and Redis. Boot migrations get a test that runs them twice against pre-upgrade state.

## Out of Scope

- `apps/mobile` (parked) and `apps/quick-import-extension` (another repository).
- The Obscura image (`docker/obscura`, Debian 12).
- A Norish GitHub Security Advisory, a 0.24.x backport, a CI audit gate, Renovate or Dependabot configuration.
- Linking or unlinking sign-in providers from settings.
