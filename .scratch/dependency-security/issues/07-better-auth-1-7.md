# 07 — Better Auth 1.7 with no manual steps

Status: superseded
Target version: 0.26.0-beta
Blocked by: 06

Spec: `.scratch/dependency-security/spec.md`

## What to build

`better-auth` and `@better-auth/*` to latest 1.7.x (`@better-auth/expo` moves too; mobile is not verified).

**The registered OIDC callback keeps working.** 1.7 moves the generic OAuth callback from `/api/auth/oauth2/callback/:id` to `/api/auth/callback/:id`, and every self-hoster has the old one registered with their provider. Pin the `oidc` provider's `redirectURI` to the old path and route that path to the new handler, if 1.7 allows it. If it does not, the docs (`apps/docs/docs/configuration/authentication.md`) give the new path and an Upgrade notes line tells self-hosters to register it. `genericOAuthClient()` is gone; replace it in `apps/web/lib/auth/client.ts` and `packages/shared/src/lib/auth/client.ts`.

**Account identity backfill at boot.** 1.7 keys accounts on `(issuer, accountId)`. A startup step in `packages/api/src/startup/` fills the issuer for existing accounts from the configured providers before auth serves a request, and does nothing on a second run.

If the callback pin holds, record it as an ADR under `docs/adr/` (every self-hoster depends on that path).

## Acceptance criteria

- [ ] Test: the backfill fills pre-1.7 account rows and is a no-op on a second run.
- [ ] Test or E2E: a sign-in through the old OIDC callback path completes.
- [ ] Password sign-in, API keys and an already-linked provider sign-in work as before (auth E2E specs).
- [ ] Release notes, docs and, if needed, an Upgrade notes line written.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`, `pnpm format:check` pass.

## Comments

- 2026-10-13 — Superseded by `.scratch/dependency-upgrades/` (decided with the maintainer the same day).
