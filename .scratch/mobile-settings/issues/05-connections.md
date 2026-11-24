# 05: Connections: site tokens, API keys and share links

**What to build:** The three Connections sub-pages (`StTokens*`, `StTokenAdd`, `StApiKeys*`, `StApiKeyNew`, `StApiKeyCreated`, `StShareLinks*`), mirroring `site-auth-tokens-card.tsx`, `api-token-card.tsx` and `share-links-table-card.tsx`.

**Blocked by:** 01

**Status:** done

- [x] Site tokens: list, add (sheet), delete with a confirm, by swipe and long-press (web has no enable or disable).
- [x] API keys: list (first six characters shown), create (sheet), the created key shown once with Copy, disable or enable (`toggleApiKey`), delete with a confirm.
- [x] Share links: list with recipe, Copy link (ticket 07: long-press only, links made from 0.28 on), revoke, reactivate, delete, by swipe and long-press.
- [x] Empty states per the canvas.
- [x] Gates green.

## Comments

- Three pages on `useSiteAuthTokensRead`, `useProfileQuery` and `useMyRecipeSharesQuery`, each now reporting `answered`, so `listState` (tested) tells loading, failed (Retry, never the empty state), a cached list through a failed refetch, and empty. Rows are `SettingsRow`s: Delete red, Disable and Revoke yellow, Enable and Reactivate green; every write is a `settingsWrite` behind web's confirm text. The rules shared with web (`shareLinkActions`, `apiKeyPrefix`, `orderedSiteTokens`, `siteTokenForm`) live in shared-react with tests; web's three cards import them.
- Sheets: add token (value kept only while the sheet is open; a failed add keeps the fields) and create key. The created key shows once with Copy (`generatedModal.copied` added in every locale), the swipe-down is off until "I've saved it", and closing the sheet drops it from state. A "Open API docs" row mirrors web's link.
- Not done: **Copy link** on share links. The server stores only a hash and returns a link's URL once, at creation (`RecipeShareCreatedDto.url`), so the list cannot copy it; web's card has none either. The share-links box stays unticked for that reason, and the spec's story 11 needs a decision (re-issue a link, or drop Copy).
- Open: `revokeShare`, `reactivateShare` and `deleteShare` have no `onError`, so a failed one is silent (web too); `toggleApiKey` and `deleteApiKey` are fire-and-forget, so the repeat guard frees at once. Canvas boards were not read; empty states use web's copy on `NoResultsCard`. `shareSubtitle` moved to `lib/share-subtitle.ts` (the feature-import rule).
- Docs writer: Connections on mobile (site tokens, API keys with the one-time key, share links).

### Review round 1 (2026-11-23): dispositions

Ask: Copy link on share links (the server keeps only a hash; web's card has none). The share-links box stays unticked until Mike decides between dropping Copy and re-issuing a link.

Gatekeeper:
- fix: "Empty states per the canvas" is ticked but the canvas was not read; read the boards and match them, row contents included.

Standards (Haiku):
- fix: `__tests__/share-subtitle.test.ts` belongs at `__tests__/lib/`.
- verify: `domainNotFull` is drawn under the Domain field; follow how the other mobile forms show a validation error.
- fix: `listState` duplicates `pageState`; one function.
- fix: the failed-load card is in `connection-list.tsx` and `household-screen.tsx`; the list scaffolding is written three times; the delete flow twice; `answered`/`refetch` repeated in three shared reads.
- fix: `send` mirrors `shareLinkActions`; `field(...)` takes five positional arguments, `text_` shadows `text`, `T` constants.
- fix: shared exports say "site token" where CONTEXT.md's term is Site Auth Token.

Spec (Sol medium):
- fix, bug: the create-key sheet can be dismissed while the request is pending, losing the key; the plaintext key stays in the mutation's result after the sheet closes.
- fix, bug: the repeat guard misses the API-key toggle (no key) and frees at once for API-key delete and the three share actions (their `mutate` returns void); share-link failures are silent.
- verify, bug: a stale site-token delete removes the surviving row from the list; a share action on a recipe deleted elsewhere leaves the dead row.
- verify: the sheets do not show why submission is off when Offline.
- fix, bug: after a failed first read, Add seeds the cache with one row, `answered` turns true and the page shows an incomplete list.
- fix: a 33-character key name is sent and refused by the server; creation dates as the canvas and web show them.

Round 1 outcome (`2ce4d8748`..`3f1ac5692`): A1-A6 and every structure finding fixed. The canvas (v117, read by the fixer) has no empty-state boards, so web's copy stays; rows now follow the boards (no icon tile on tokens and keys, "prefix… · date" on keys, one date line on share links). The boards' recipe thumbnail on share links is not possible: the share DTO carries no image. `domainNotFull` under the field matches how the password sheet draws its errors (does not hold). Android's hardware back is not blocked on the created-key sheet. Exit gates all 0 at `3f1ac5692`, mobile lint 11. The flaky `worklet-closures` test was fixed separately in `3e291aac6`.

### Review round 2 (2026-11-24): fix range `3e291aac6..3f1ac5692` (Sol medium)

- fix, bug (`2ce4d8748`): on web, Escape closes the created-key dialog without clearing the key or the mutation.
- verify, bug (`2ce4d8748`): creating a key stores the plaintext response in Valkey for seven days through the idempotency middleware (`idempotency-middleware.ts:149`), and development web logs it (`trpc-links.ts:335`). Before this ticket too, but it is a stored secret.
- fix (`2ce4d8748`, `64233465a`): a request the server never answers keeps the created-key sheet locked and a row's guard held for ever.
- fix, bug (`e15ed3d11`): a stale or failed share action from Settings does not reread the per-recipe share lists (`if (recipeId)` with `null`).
- fix, bug (`55d69b608`): an Add during the first list read reuses that in-flight request, whose result can hide the new token.
- fix (`465bbcf7c`): the created-key sheet body has no Offline capsule.
- fix (`b83d42bcf`): web sends a name of only spaces; mobile trims it.
- reject: a Norish link opened from outside while the key sheet is up dismisses it (`redirect-link.ts:37` `router.dismissAll()`). The reader deletes that key and creates another; teaching the global link handler about one sheet is not worth the coupling. Mike can overrule.
- sound per the reviewer: `6aac113f4`, `aacf145dc`, `90a1e36e4`, `fa954ef35`, `3f1ac5692`, `8c3712c28`.

Round 2 outcome: fixed in `add818f6d` (web's dialog drops the key however it closes), `a09d111dc` (a Settings write unanswered after 30 s is released as failed), `47308357e`, `15fb46769`, `959050f2d`, `8f928afd5`. Exit gates all 0 at `8f928afd5`, mobile lint 11. No third re-review: the final whole-branch pass reads this ticket.

Asks left with Mike:
- Copy link on share links (the share-links box stays unticked for it).
- The idempotency middleware stores the plaintext response of `apiKeys.create` and `shareCreate` in Valkey for seven days, and a replay returns it. Confirmed, unchanged. Options: don't store (a replay makes a second key), store redacted (breaks `RecipeShareCreatedSchema`), or store a marker and refuse the replay (recommended), plus keeping both out of the Outbox.

### Mike's decisions (2026-11-24)

- Copy link: add a way to view a share link. It needs the server to keep the token readable, so it is ticket 07; the share-links box here stays unticked until 07 is done.
- Stored one-time secrets: store a marker and refuse the replay, and keep `apiKeys.create` and `recipes.shareCreate` out of the Outbox.
- Outbox: only writes that carry a secret stay out (`offline/uncaptured.ts` already lists the credential inputs). The spec's line is changed to say so.

Outcome of the secrets decisions (2026-11-24): `cdf9563e6` (`user.apiKeys.create` and `recipes.shareCreate` store a marker; a replay or a waiting duplicate gets `CONFLICT` with no secret), `27f6c7823` (both in `uncaptured.ts`), `b4f5a5aab` (format). No client can receive the refusal: only Outbox replay and recipe imports resend an operation id. No server logger writes response bodies; web's dev `loggerLink` runs in the browser and was left. No other Settings procedure carries a credential. Gates all 0 as the fixer reported; reviewed in the closing pass.
