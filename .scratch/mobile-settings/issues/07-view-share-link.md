# 07: View and copy a share link

**What to build:** A reader can copy a recipe share link they made earlier. Today the server keeps only `token_hash` (`packages/db-schema/src/schema/recipe-shares.ts`), so the link exists only in the answer to `recipes.shareCreate`.

**Blocked by:** 05

**Status:** ready-for-agent

- [x] The server keeps a new share's token encrypted (`@norish/config/crypto`, as `site-auth-tokens.ts` does) in a nullable column next to `token_hash`, with a migration. Shares made before have none.
- [x] A query returns one share's link to whoever may manage that share today (the same check revoke uses), and to no one else. It is a query, so nothing about it is stored for Replay.
- [x] The share DTO says whether a link can be shown, without carrying the token.
- [x] shared-react: one hook in the recipes domain that fetches the link on demand; the link is not kept in the query cache after it is copied.
- [ ] Mobile Settings → Share links: Copy link by swipe and long-press on a share that has one; a share made before has no Copy link action. Disabled Offline like the other actions.
- [x] Tests: the repository round-trip, the permission check on the query (owner, other household member, outsider), the row actions with and without a link.
- [x] Gates green.

Not in this ticket: web's share-links table (the hook is there for it), and re-issuing a link for an old share.

## Comments

- Server: nullable `token_enc` (migration `0087_recipe_share_token_enc`), `hasLink` on every share summary, and `recipes.shareUrl` (revoke's check; `{ url: null }` for an old share). Output is never logged (`api_logs` keeps no bodies) and queries skip the idempotency store.
- `useShareLink` reads through the vanilla tRPC client, so the link never enters the query cache; mobile holds it in a local until the clipboard has it. A failed read toasts Operation failed.
- Decided: Copy only on an **active** share with a link (a revoked or expired link opens nothing); `shareLinkActions` now takes the share and lists `copy`, which web's card ignores (no web UI change).
- Deviation, box 5 unticked: Copy is in the long-press menu only. `swipeActions` drops Copy since ticket 01 checked the canvas (copy is menu-only there); adding it to the swipe is a one-line change if Mike wants the ticket's wording.
- Docs writer: Settings → Share links on mobile can copy links made from 0.28 on; older links show no Copy (re-issue is not offered).
