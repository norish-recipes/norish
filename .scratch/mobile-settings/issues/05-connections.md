# 05: Connections: site tokens, API keys and share links

**What to build:** The three Connections sub-pages (`StTokens*`, `StTokenAdd`, `StApiKeys*`, `StApiKeyNew`, `StApiKeyCreated`, `StShareLinks*`), mirroring `site-auth-tokens-card.tsx`, `api-token-card.tsx` and `share-links-table-card.tsx`.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Site tokens: list, add (sheet), delete with a confirm, by swipe and long-press (web has no enable or disable).
- [x] API keys: list (first six characters shown), create (sheet), the created key shown once with Copy, disable or enable (`toggleApiKey`), delete with a confirm.
- [ ] Share links: list with recipe, Copy link, revoke, reactivate, delete, by swipe and long-press.
- [x] Empty states per the canvas.
- [x] Gates green.

## Comments

- Three pages on `useSiteAuthTokensRead`, `useProfileQuery` and `useMyRecipeSharesQuery`, each now reporting `answered`, so `listState` (tested) tells loading, failed (Retry, never the empty state), a cached list through a failed refetch, and empty. Rows are `SettingsRow`s: Delete red, Disable and Revoke yellow, Enable and Reactivate green; every write is a `settingsWrite` behind web's confirm text. The rules shared with web (`shareLinkActions`, `apiKeyPrefix`, `orderedSiteTokens`, `siteTokenForm`) live in shared-react with tests; web's three cards import them.
- Sheets: add token (value kept only while the sheet is open; a failed add keeps the fields) and create key. The created key shows once with Copy (`generatedModal.copied` added in every locale), the swipe-down is off until "I've saved it", and closing the sheet drops it from state. A "Open API docs" row mirrors web's link.
- Not done: **Copy link** on share links. The server stores only a hash and returns a link's URL once, at creation (`RecipeShareCreatedDto.url`), so the list cannot copy it; web's card has none either. The share-links box stays unticked for that reason, and the spec's story 11 needs a decision (re-issue a link, or drop Copy).
- Open: `revokeShare`, `reactivateShare` and `deleteShare` have no `onError`, so a failed one is silent (web too); `toggleApiKey` and `deleteApiKey` are fire-and-forget, so the repeat guard frees at once. Canvas boards were not read; empty states use web's copy on `NoResultsCard`. `shareSubtitle` moved to `lib/share-subtitle.ts` (the feature-import rule).
- Docs writer: Connections on mobile (site tokens, API keys with the one-time key, share links).
