# 09 — Better Auth 1.7

Status: resolved
Blocked by: 08. Ticket 10 lands in the same commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move every `@better-auth/*` package and `better-auth` to the 1.7 line (1.7.7 at research time). `@better-auth/utils` stays at 0.4.2, which is still the exact peer.

For Norish, 1.7 is a migration, not a bump. Each item below comes from the 1.7.7 tarball diff and the 1.7 upgrade guide.

1. **The Redis secondary storage gains `increment` and `getAndDelete`** (`packages/auth/src/auth.ts`, `secondaryStorage`).
   - **Why.** Without `increment`, every rate-limited `/api/auth` request throws ("Secondary-storage rate limiting requires SecondaryStorage.increment").
   - **How.**
     - Use `GETDEL` (Redis ≥ 6.2; compose ships 8.10.1).
     - Use `INCR` with the expiry set on the first increment, through Lua or `MULTI`.
     - **Prefix the new counter keys.** The existing `ip|path` rate-limit keys hold JSON, so `INCR` on them would error during the first window after deploy.
   - **Landing early.** This part can land before the bump: on 1.6.33 it makes rate limiting atomic.
2. **The generic OAuth plugin was rewritten.**
   - **Removed.** The plugin's own endpoints (`/sign-in/oauth2`, `/oauth2/callback/:providerId`, `/oauth2/link`) are gone, and so is `genericOAuthClient`.
   - **Client side.** Drop `genericOAuthClient` from `apps/web/lib/auth/client.ts` and `packages/shared/src/lib/auth/client.ts`.
   - **Sign-in calls.** `signIn.oauth2(...)` becomes `signIn.social({ provider: "oidc" })` at `apps/web/app/(auth)/login/components/provider-button.tsx` and `auto-sign-in.tsx`.
3. **The OIDC callback URL moves.** It becomes `/api/auth/callback/oidc`; today it is `/api/auth/oauth2/callback/oidc`, as documented in `apps/docs/docs/configuration/authentication.md`.
   - **Impact.** Every self-hoster's identity-provider registration breaks unless Norish keeps the old URL working.
   - **Decision (2026-10-13): the old URL keeps working**, because self-hosters take no manual steps.
     - Set `redirectURI` to the absolute legacy URL. In 1.7.7 a generic-OAuth `redirectURI` wins in both the authorize URL (`core oauth2/create-authorization-url.mjs:29`) and the token exchange (`validate-authorization-code.mjs:41`).
     - Forward `/api/auth/oauth2/callback/[id]` to `/api/auth/callback/[id]` with the query string intact. Without it the catch-all `apps/web/app/api/auth/[...all]/route.ts` answers 404, because 1.7.7 has no `/oauth2/callback` endpoint.
     - Prove it with an OIDC test. Document the new URL; the old one stays until a later release deprecates it.
4. **The account id is read from `profile.sub`** when discovery lists `id_token_signing_alg_values_supported` (`generic-oauth/index.mjs:102,140-146`). Norish's custom `getUserInfo` returns only `id`, so every OIDC login would throw `OAUTH_ACCOUNT_SUBJECT_INVALID` and redirect with `unable_to_get_user_info`. Return `sub` as well. Stored rows hold `accountId = sub` (1.6 used `getUserInfo().id`, which Norish sets to `sub`), so existing `account` rows still match.
5. **ID tokens are verified** against the discovery JWKS, issuer, audience and nonce. HS256-signed ID tokens fail; an Authentik provider without a signing key does this, though that is unverified. → Upgrade note.
6. **Discovery is fetched once, at startup.** If the IdP is down at that moment, OIDC stays disabled until Norish restarts. → Upgrade note. A retry is a possible follow-up.
7. **Sign-out redirects to the IdP's end-session URL.** That races Norish's own `window.location.href = "/login?logout=true"` (`apps/web/context/user-context.tsx`). Set `disableProviderLogout: true`; IdP logout is a later improvement.

**Not breaking:**

- Cookie names and signing, the Redis session format and the session defaults are unchanged, so users stay signed in. Only OAuth logins that are in flight at deploy time fail.
- No table or column changes; the `apikey` schema is identical too. Accounts are still keyed on `(providerId, accountId)` (`findAccountOwnerByKey`). The `issuer` column and its backfill that `.scratch/dependency-security/` ticket 07 planned existed only in 1.7.0–1.7.2; 1.7.3 removed them (`core dist/db/schema-diff.mjs:81`).
- The error code `email_doesn't_match` is renamed `email_does_not_match`; Norish doesn't read it.
- `oidcProvider` and MCP moved to separate packages, which Norish doesn't use.
- `experimental.joins` became `advanced.database.joins`, and stays off.
- `rateLimit.customStorage` now takes only `consume`, which Norish doesn't use.
- `getIp` is renamed `getIP`; Norish doesn't import it.
- Origin and relative-URL checks are stricter; Norish uses plain paths.
- `validateSchema` is skipped, because the encrypted-email adapter wrapper is a new object.
- The api-key plugin is unchanged.

## Acceptance criteria

- [x] **Versions.** Every `@better-auth/*` package is on 1.7.x and utils on 0.4.2, with one copy each. `@better-auth/expo` is gone (ticket 23).
- [x] **Rate limiting is tested with the limiter on.** The new storage methods have unit tests, and at least one automated run has rate limiting on: `AUTH_RATE_LIMIT_ENABLED=true` in an integration test or an E2E variant. The E2E harness turns it off (`production-stack.ts`), so the suite can't catch item 1 as it stands.
- [x] **OIDC end to end:**
  - first login;
  - returning login, matching the existing account row;
  - ~~the legacy redirect URI still works~~ dropped 2026-10-13, see Comments;
  - an IdP that is down at startup behaves as documented;
  - sign-out lands on `/login`.
- [x] **Unchanged flows.** GitHub, Google, password and API keys (REST and WebSocket) behave as before.
- [x] **Schema.** `pnpm db:generate` produces no migration.
- [x] **Gates and type check.** The gates, `pnpm typecheck` and E2E pass.
- [x] **Docs and Upgrade notes.**
  - `authentication.md` shows the new callback URL ~~, and the legacy one for as long as it works~~.
  - The 0.26 Upgrade notes cover: ID tokens must be RS- or ES-signed; ~~the IdP must be reachable when Norish starts~~ (not needed once discovery is retried, see Comments); sign-out still doesn't end the IdP session.

## Comments

- Filed 2026-10-12 with the spec.
- Later improvements, out of scope here:
  - `requireIdTokenVerification: true`, since token claims grant server admin and households;
  - IdP logout through `postLogoutRedirectURI`;
  - `user.validateUserInfo` in place of the registration gate in `databaseHooks.user.create.before`;
  - `authClient.hydrateSession`, to skip the first `/get-session`;
  - a `TRUSTED_PROXIES` setting mapped to `advanced.ipAddress.trustedProxies`.
- 2026-10-13 — Checked against the 1.6.33 and 1.7.7 tarballs: no schema change and no backfill; the `sub` fix and the callback forward are required; `trustedProviders` behaves as in 1.6. The legacy-URL decision is made. Ticket 10's `disableImplicitLinking` lands in the same commit.
- 2026-10-13 — **The legacy callback URL is not kept** (maintainer, during implementation: "No legacy code allowed, breaking changes are fine"). This reverses the item 3 decision and spec decision 16 for OIDC: no `redirectURI` override and no forward from `/api/auth/oauth2/callback/:id`. The OIDC callback is 1.7's `/api/auth/callback/oidc`; `authentication.md` shows it and an Upgrade note tells self-hosters to change the redirect URI at their identity provider. For the same reason the rate-limit counters use the bare `ip|path` key: a JSON record 1.6 left there makes INCR fail for at most one window (60 s, or 10 s for sign-in) after the upgrade.
- 2026-10-13 — Done on 1.7.7 (`better-auth`, core, api-key; utils 0.4.2; one copy each, no peer warnings; `@better-auth/utils` 0.5.0 is still better-call 1.4.0's own dependency). What changed beyond the items above:
  - The storage moved to `packages/auth/src/secondary-storage.ts`: `increment` is one Lua script (INCR, EXPIRE only on creation), `getAndDelete` is GETDEL. Tested against a real Redis (testcontainers): a fixed window that is never extended, and 25 concurrent increments counted 1–25.
  - **The encrypted-email adapter also wraps `findMany`.** 1.7 finds an OAuth account's owner with `findMany` joined onto the user, not `findOne`, so the user came back with an encrypted email and a provider's verified email never matched it. The existing "marks a user verified" test caught it.
  - OIDC's `getUserInfo` returns `sub`; `disableProviderLogout: true`; the clients drop `genericOAuthClient` and every provider signs in through `signIn.social`.
- 2026-10-13 — **How it was verified.** `packages/auth/__tests__/auth/auth-handler.test.ts` drives the real auth config through Better Auth's HTTP handler, with a fake identity provider (discovery, JWKS, token, userinfo; RS256 ID tokens signed with node:crypto), a real Redis and the memory adapter: first sign-in (account keyed on `sub`), returning sign-in to the same user and account row, the `redirect_uri` sent to both the authorize URL and the token exchange, an ID token signed by another key refused with `unable_to_get_user_info`, sign-out answering without an IdP logout URL (so `user-context.tsx`'s `/login?logout=true` is where the browser goes), an identity provider down when the instance is built (`/sign-in/social` answers 404), the fourth sign-in within 10 s answered 429 with `AUTH_RATE_LIMIT_ENABLED=true`, and an API key read by `getSession` (the path REST and the WebSocket share through `getVerifiedSession`). Each 1.7 change was removed once to see its test fail. GitHub and Google were not run against the real providers: their sign-in after the provider answers is `handleOAuthUserInfo`, covered by `oauth-email-verification.test.ts`; password sign-in is what the whole E2E suite logs in with. **Not verified here:** a real identity provider (Authentik, PocketID, Keycloak) in a browser, and the WebSocket itself with an API key. `pnpm db:generate`: no changes. Gates, typecheck, format:check and deps:cycles pass; `pnpm test:e2e`: 175 passed.
- 2026-10-13 — **Found on the way, fixed in its own commit:** with registration closed, a new user's SSO sign-in answered with a bare 403 JSON instead of the auth-error page, because the registration gate's `APIError` carries no `code` and the OAuth callback only redirects errors that have one. better-call 1.4.0 already shipped with 1.6.33, so 0.25 behaves the same.
- 2026-10-13 — **Discovery is retried** (the follow-up item 6 named), in its own commit. When the instance in use has no OIDC provider, the first auth access 30 seconds later builds a replacement in the background, which fetches discovery again and takes over only once it has the provider; requests keep the instance in use meanwhile, because Better Auth's discovery fetch has no timeout and a provider that takes the connection and never answers would otherwise hold up every session check. The `auth` proxy hands out methods that call whichever instance is current, since the auth route exports `auth.handler` once at load. Tested with the fake provider down at build time, then back (a handler held from before the rebuild starts OIDC sign-in once the replacement is in), and with a provider that never answers (session checks still resolve). The "identity provider must be reachable when Norish starts" Upgrade note is dropped with it. Both flaws were found by the branch review.
- 2026-10-14 — **`TRUSTED_PROXIES` is built** (maintainer: "Yes build this"), in its own commit: a comma-separated list of proxy IPs or CIDR ranges passed to `advanced.ipAddress.trustedProxies`, empty by default (empty behaves exactly as before). Behind two proxies the header reads `client, proxy`, which 1.7 cannot resolve without it, so every visitor shared one bucket per path, `/get-session` included. Tested in `auth-handler.test.ts` (two visitors behind two proxies each get their own sign-in limit; fails without the setting) and on the built server against throwaway containers: with `TRUSTED_PROXIES=10.0.0.0/24` the second visitor got 401 after the first hit 429, without it 429. Documented in Server & runtime, `.env.example`, the compose example, and an Upgrade note.
