# 07: View and copy a share link

**What to build:** A reader can copy a recipe share link they made earlier. Today the server keeps only `token_hash` (`packages/db-schema/src/schema/recipe-shares.ts`), so the link exists only in the answer to `recipes.shareCreate`.

**Blocked by:** 05

**Status:** done

- [x] The server keeps a new share's token encrypted (`@norish/config/crypto`, as `site-auth-tokens.ts` does) in a nullable column next to `token_hash`, with a migration. Shares made before have none.
- [x] A query returns one share's link to whoever may manage that share today (the same check revoke uses), and to no one else. It is a query, so nothing about it is stored for Replay.
- [x] The share DTO says whether a link can be shown, without carrying the token.
- [x] shared-react: one hook in the recipes domain that fetches the link on demand; the link is not kept in the query cache after it is copied.
- [x] Mobile Settings → Share links: Copy link in the long-press menu (not the swipe: ticket 01 keeps Copy out of swipes, as the canvas shows it) on a share that has one; a share made before has no Copy link action. Disabled Offline like the other actions.
- [x] Tests: the repository round-trip, the permission check on the query (owner, other household member, outsider), the row actions with and without a link.
- [x] Gates green.

Not in this ticket: web's share-links table (the hook is there for it), and re-issuing a link for an old share.

## Comments

- Server: nullable `token_enc` (migration `0087_recipe_share_token_enc`), `hasLink` on every share summary, and `recipes.shareUrl` (revoke's check; `{ url: null }` for an old share). Output is never logged (`api_logs` keeps no bodies) and queries skip the idempotency store.
- `useShareLink` reads through the vanilla tRPC client, so the link never enters the query cache; mobile holds it in a local until the clipboard has it. A failed read toasts Operation failed.
- Decided: Copy only on an **active** share with a link (a revoked or expired link opens nothing); `shareLinkActions` now takes the share and lists `copy`, which web's card ignores (no web UI change).
- Deviation, box 5 unticked: Copy is in the long-press menu only. `swipeActions` drops Copy since ticket 01 checked the canvas (copy is menu-only there); adding it to the swipe is a one-line change if Mike wants the ticket's wording.
- Docs writer: Settings → Share links on mobile can copy links made from 0.28 on; older links show no Copy (re-issue is not offered).

### Review (2026-11-24, `b5606d8b2..871351a7a`; Standards Haiku, Spec Sol high): dispositions

Sound per the Spec reviewer: who the query answers matches revoke (others get the same not-found as a missing share), the migration keeps existing links, lists and events carry no token, the read stays out of React state, the query cache, the Outbox and the idempotency store, no web UI change.
- fix, bug: `shareUrl` returns the link of a share revoked or expired after the list loaded (`shares.ts:224`), and Copy reports success for a dead link. The query answers no link unless the share is active; mobile rereads the list.
- fix: a stored token that cannot be decrypted throws (`recipe-shares.ts:100`), and tRPC logs the crypto error. It answers no link.
- fix, verify: the link is read by a GET query and the tRPC route sets no `Cache-Control: no-store` (`apps/web/app/api/trpc/[trpc]/route.ts:10`), so a cache could keep it.
- fix: `copyLink` in `share-links-screen.tsx` repeats the failure toast `useCopyToClipboard` already shows; `shareLinkActions` tests `status === "active"` twice.
- reject: a copy still in flight at sign-out can finish afterwards (the reader's own link on the reader's own device, two pages apart).
- reject: web's development `loggerLink` would print the link if web ever called the hook (browser console, development only, no web caller; the same holds for a new API key today).
- reject: `url` holds a path (`RecipeShareCreatedSchema.url` is named the same); the swallowed read error (the toast is the same either way); the test's mock factory.

### Fix outcome (2026-11-24)

- `getRecipeShareUrl` answers no link unless the share is active (the list's status rule) or when the kept token won't decrypt (nothing logged); mobile rereads the list on a null link. `copyLink` now fails through `useCopyToClipboard`'s one toast (it takes a promise); `shareLinkActions` is one branch per status.
- Verify held: Next sends no `Cache-Control` on a dynamic route handler (`build/templates/app-route.js` sets it only for ISR) and iOS `NSURLCache` may keep GETs; the tRPC route's `responseMeta` now answers `no-store` on every response (the service worker is already NetworkOnly for `/api/`, nothing relies on HTTP caching). Route test added. All gates green; mobile lint at 11 warnings.

Exit gates at `e66e5f721` (Haiku verifier): all seven 0, mobile lint 11. The fix commits are read once more in the closing review.
