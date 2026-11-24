# 07: View and copy a share link

**What to build:** A reader can copy a recipe share link they made earlier. Today the server keeps only `token_hash` (`packages/db-schema/src/schema/recipe-shares.ts`), so the link exists only in the answer to `recipes.shareCreate`.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The server keeps a new share's token encrypted (`@norish/config/crypto`, as `site-auth-tokens.ts` does) in a nullable column next to `token_hash`, with a migration. Shares made before have none.
- [ ] A query returns one share's link to whoever may manage that share today (the same check revoke uses), and to no one else. It is a query, so nothing about it is stored for Replay.
- [ ] The share DTO says whether a link can be shown, without carrying the token.
- [ ] shared-react: one hook in the recipes domain that fetches the link on demand; the link is not kept in the query cache after it is copied.
- [ ] Mobile Settings → Share links: Copy link by swipe and long-press on a share that has one; a share made before has no Copy link action. Disabled Offline like the other actions.
- [ ] Tests: the repository round-trip, the permission check on the query (owner, other household member, outsider), the row actions with and without a link.
- [ ] Gates green.

Not in this ticket: web's share-links table (the hook is there for it), and re-issuing a link for an old share.

## Comments
