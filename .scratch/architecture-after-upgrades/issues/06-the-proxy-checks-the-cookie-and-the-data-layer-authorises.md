# 06: The proxy checks the cookie, the data layer authorises

**What to build:**

- Pages and images start loading without a database lookup in front of them.
- The proxy only checks that a session cookie is present. The real check happens where data is read:
  - the signed-in app's layout, for pages
  - the recipe media helper and the avatar route, for images
  - the exports and tRPC, unchanged
- A reader whose session expired still lands on the login page and returns to the page they asked for after signing in.
- A reader whose account was deleted is signed out at the next page load. The sweep's ticket 10 already does this by ending a deleted account's sessions at once; the layout keeps it true for a session that outlived a failed deletion.
- An image request without a valid session is not served. A share link's images still load.
- A route added later without the session check fails the build.

See `.scratch/architecture-after-upgrades/spec.md`, Page loads and the auth gate. The reasoning (Next's guidance that the proxy makes optimistic checks, and the cost per image) belongs in the commit message, not an ADR.

**Blocked by:** None within this spec. The matcher anchoring (the sweep's ticket 56) and Better Auth 1.7 (09, 10) land first on `chore/dependency-upgrades`.

**Status:** ready-for-agent

- [x] The proxy reads no Redis or Postgres and decrypts nothing. With no session cookie it redirects to the login page with the destination as the callback. It forwards the original path to the app as a request header.
- [x] The signed-in app's layout:
  - [x] Redirects a request with no session to the login page with the forwarded destination.
  - [x] Reads the session through the existing `getVerifiedSession`, which revokes a session whose account no longer exists, as the proxy did, and redirects that session the same way. Say "a session whose account no longer exists", not "orphaned": CONTEXT.md's **Orphaned** names a recipe or cookbook.
- [x] The settings page reuses the layout's per-request session read instead of its own.
- [x] The recipe media helper's owner path and the avatar route require a valid session, and answer an unauthorised request like a missing file (404, not cached). The share path keeps its share-token check.
- [x] The proxy's unreachable WebSocket branch is deleted (moved here from ticket 07, since this ticket rewrites the proxy).
- [x] A structural test fails if any route handler under the signed-in app does not perform the session check.
- [x] A test of the layout's gate: a session whose user row is gone is revoked and redirected to the login page.
- [x] Browser E2E:
  - [x] A signed-out reader opening a recipe lands on login and returns to the recipe after signing in.
  - [x] A recipe image requested without a session is not served.
  - [x] A share link's images load signed out.
- [x] Measure time to skeleton on a cold load (phone profile) before and after, and record both here. The after number is ticket 08's baseline.
- [x] The auth E2E specs pass against a fresh `pnpm build`.

## Comments

- 2026-10-14, implemented:
  - **The proxy.** `apps/web/proxy.ts` calls `hasCredential(headers)` (`@norish/auth/credentials`): Better Auth's `getSessionCookie`, which accepts the `__Secure-` prefix, or an API-key header. API keys get sessions (`enableSessionForAPIKeys`), so a client fetching an image with one would otherwise be sent to login; the header list is now one constant that the API-key plugin uses too. The proxy imports nothing that reads the database.
    - `/share` joined the matcher's skipped directories. That replaces `shouldBypassAuthProxy`, which was the proxy's last import of the database repositories.
    - The original path and query are forwarded as `x-norish-destination`.
  - **The layout gate.** `readRequestProfile` (`lib/request-profile.ts`) reads the principal, then runs `verifySessionPrincipal` (the second half of `getVerifiedSession`, which revokes a session whose account is gone) in parallel with the preferences read. A session that fails reads as signed out.
    - The `(app)` layout redirects to `/login?callbackUrl=<forwarded destination>`. That is a real 307: a forged cookie on `/recipes/…` answered `307 → /login?callbackUrl=%2Frecipes%2F…%3Fx%3D1` on the production build.
    - The settings page takes `identity.isServerAdmin` from the same read. That is the database's role, not the session's sign-in snapshot.
  - **The media routes.** `refuseWithoutSession(req)` (`lib/auth/media-session.ts`) reads the session in Redis with no Postgres lookup. It is called by the recipe, step, cookbook and avatar routes; the share routes keep their token check. No session gives `404` with `no-store`, before any file is read.
  - **Tests.**
    - `__tests__/app/signed-in-routes.test.ts`: every `route.ts` under `app/(app)` calls `refuseWithoutSession(` or `auth.api.getSession(`.
    - `__tests__/app/auth/signed-in-layout.test.tsx`: a session whose account is gone is revoked and redirected with its destination; no session is redirected without touching the database; a live session renders.
    - The proxy, media-route and avatar tests now cover the cookie check, the forwarded destination and the uncached 404.
    - The browser spec is `ai/auth-gate.e2e.ts`; it runs with the batch.
  - **Measurements.** Production build on this Mac against the local stack, signed in as the dev owner. Before: `2d5b3215` (tickets 01 to 04 and 11, the proxy unchanged). After: this commit.
    - Phone profile: Playwright Pixel 7 with CPU throttling ×4 and a slow-4G throughput cap, service worker blocked, one warm-up load, then the median of 15 cold loads. Chromium's emulated latency does not reach `responseStart`, so the TTFB column is the server's own time.

      | Page            | TTFB before | TTFB after | First paint before | First paint after |
      | --------------- | ----------- | ---------- | ------------------ | ----------------- |
      | `/`             | 17 ms       | 11 ms      | 1,600 ms           | 1,608 ms          |
      | `/recipes/<id>` | 15 ms       | 12 ms      | 1,544 ms           | 1,540 ms          |
      | `/groceries`    | 13 ms       | 13 ms      | 1,552 ms           | 1,548 ms          |

    - Server time to response headers (Node `fetch`, 100 sequential requests after 10 warm-ups, median / p90):

      | Request         | Before         | After          |
      | --------------- | -------------- | -------------- |
      | `/`             | 11.4 / 13.9 ms | 10.2 / 16.1 ms |
      | `/recipes/<id>` | 9.1 / 10.8 ms  | 7.5 / 9.2 ms   |
      | an image (404)  | 1.5 / 1.8 ms   | 1.0 / 1.2 ms   |

    - Reading it:
      - Locally, Redis and Postgres answer in well under a millisecond, so the proxy's read cost 1 to 1.5 ms per page and 0.5 ms per image.
      - First paint is set by downloading and parsing the page's CSS and JS on a throttled phone, and did not move.
      - Each saved round trip grows with the distance to Postgres and Redis, so the gain is larger on a deployment where they sit on another host.
      - **The baseline for ticket 08 is the "after" columns.**
  - **Left as it was, for a decision:** recipe, step and cookbook images are still served `Cache-Control: public, max-age=31536000, immutable`. A shared cache (a CDN in front of Norish) may keep such an image and serve it to anyone with the URL, past the new session check. Avatars use `private`. Making the others `private` is one word per route, but it changes how a CDN in front of Norish caches, so it is the maintainer's call.
- 2026-10-14. E2E: the full browser suite passed against a fresh build on 2026-10-14: 181 of 181, no flaky test. `ai/auth-gate.e2e.ts` holds the three browser scenarios.
- 2026-10-15, the maintainer's decision on the left-open media cache, plus a pass over everything the proxy now lets through:
  - **Media is locked down unless publicly shared.** Recipe, step and cookbook media answer only a reader who may open the recipe or cookbook under the permission policy (`refuseUnlessViewer`), and are cached `private`. A share serves its media through `/share/{token}/…`, so shares are unaffected.
  - **Media uploads and deletes check the recipe.** The eight image and video procedures had no `assertRecipeAccess`, and an upload's `recipeId` became a directory name unchecked. Each now takes a UUID and asks for edit access; a recipe not stored yet (the new-recipe form uploads first) passes as the caller's own.
  - **The instance-wide export asks the database who is admin**, not the session, which keeps the role it was signed in with.
