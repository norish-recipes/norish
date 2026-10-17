# 09: Settings tabs are seeded

**What to build:** A full load of a settings tab draws its fields filled, not empty.

- Seed by `?tab` in `app/(app)/settings/page.tsx`:
  - **User (the default tab):** `user.get` and `user.getAllergies`, `recipes.shareListMine`, `siteAuthTokens.list`, `config.localeConfig`, `config.timersEnabled`. `user.get` is watched above the page, so this needs 06's fill-during-render boundary.
  - **CalDAV:** `getConfig`, `getSyncStatus`, `getSummary`. Never `getPassword` (a secret in a document the service worker caches) and never `checkConnection` (it calls the reader's CalDAV server).
  - **Household:** comes with 03.
- `user.get` carries API-key metadata, which would then sit in a document the service worker caches (the reason 03 leaves it out). Seed it only if the user tab draws those keys anyway; otherwise leave it to the browser and seed the rest.

**Blocked by:** 01, 03, 06.

**Status:** done

- [x] `first-paint.e2e.ts`: the user tab's server markup has the reader's name in its field.
- [x] 01's harness, `/settings?tab=user`: before and after.

## Comments

- 2026-10-17, **done.**
  - `settings/page.tsx` seeds by `?tab`: the user tab (also the default) `user.get`, `recipes.shareListMine`, `siteAuthTokens.list`, `config.localeConfig` and `config.timersEnabled` (allergies come with 03's shell seed); CalDAV `getConfig`, `getSyncStatus` (page 1, 20, pending, as the tab opens) and `getSummary`. Never `getPassword` or `checkConnection`. Household comes with 03; ingredients and admin read nothing.
  - **`user.get` is seeded on the user tab.** Its API-key metadata is each key's id, name, prefix (`start`), creation date, expiry and enabled flag. The tab draws the name, prefix, date and status of every key, so they are in the document's markup anyway; seeding adds only the ids and expiry dates.
  - **One duplicate request.** The settings route has a `loading.tsx`, so its page sits in a Suspense boundary and hydrates after the shell. The shell's `user.get`, `config.localeConfig` and `config.timersEnabled` observers mount first and ask, before the page's seed fills them. The field still draws filled from the server's markup; the request is the price of not seeding `user.get` app-wide.
  - `first-paint.e2e.ts` finds the reader's name in the field in the server's markup.

  | `/settings?tab=user` (ms) | Before              | After          |
  | ------------------------- | ------------------- | -------------- |
  | first paint               | 704 (652–728)       | 680 (656–740)  |
  | the name filled           | 5,895 (5,845–6,080) | 704 (668–977)  |
  | document                  | 44.7 KB gzip        | 49.1 KB gzip   |
