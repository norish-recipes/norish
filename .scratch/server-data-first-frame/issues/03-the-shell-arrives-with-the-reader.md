# 03: The shell arrives with the reader

**What to build:** Every full load of the signed-in app carries who the reader is, so the navbar avatar, the edit actions, hearts and allergy flags are in the first frame.

- Seed in `app/(app)/layout.tsx`, handed to the App Shell as a prop (the offline bootstrap mounts the same shell with none): the reader's identity for `useUser` (`packages/shared-react` `use-user.ts`), `permissions.get`, `favorites.list`, `user.getAllergies`, `recipes.getPending` and `households.get`.
- The boundary sits inside `AuthProviders`, above the providers that read these, so they are new to the cache and fill during render. `QuerySeed` returns its dehydrated state for this, instead of only wrapping children.
- **Not `user.get`:** it carries API-key metadata, and the service worker caches documents.
- The identity must be the same in the server render and the hydrating one; the account-switch path stays as it is.

**Blocked by:** 01.

**Status:** done

- [x] `first-paint.e2e.ts`: the server's markup has the navbar avatar and a recipe's actions menu for an editor.
- [x] 01's harness: before and after for `/` and a recipe (avatar, actions).

## Comments

- 2026-10-16, **done.**
  - **How.** `QuerySeed` became `readQuerySeed` (the dehydrated state, or nothing for a non-document request) plus the `QuerySeed` wrapper. `app/(app)/layout.tsx` reads `permissions.get`, `households.get`, `favorites.list`, `user.getAllergies` and `recipes.getPending` through it, beside the Device Preferences and today, and hands the state and the verified reader (`id`, `email`, `name`, `image`, `version`) to the App Shell, which also takes the Offline Cache's seeded owner from it (the separate `userId` prop is gone). The shell puts a `QuerySeedBoundary` right inside `AuthProviders`, so these queries are new to the cache and fill during render, and passes the reader to `UserProvider`, which provides it as `ReaderSeedContext`. `useUser` returns that reader on the server and in the hydrating render, and keeps it after hydration until the session first answers; then the session decides, so an account switch or a sign-out reads as before. That first answer is latched: better-auth reports pending again on every refetch while signed out, and without the latch a window focus after signing out brought the server's reader back (found in review, `use-user-hydration.test.tsx` covers it). The offline bootstrap mounts the shell without either.
  - **`user.get` stays out**, as the ticket says.
  - **The actions menu.** Its button was already in the first frame; what waited on the reader and the permissions were its items (Share, Edit, Delete). `first-paint.e2e.ts` opens a recipe with the session and `permissions.get` never answering and finds Edit in the menu, and asserts the avatar in the server's markup. The harness measures the hearts instead of the button, since those are drawn.
  - **Measured** (service worker blocked, median and spread of 15, ms):

    | Page   | Mark        | Before                  | After                 |
    | ------ | ----------- | ----------------------- | --------------------- |
    | `/`    | first paint | 608 (584–1,012)         | 616 (596–704)         |
    | `/`    | avatar      | 6,192 (6,056–6,654)     | 616 (596–704)         |
    | recipe | first paint | 756 (624–896)           | 644 (624–1,096)       |
    | recipe | avatar      | 6,309 (6,137–6,441)     | 644 (624–1,096)       |
    | recipe | heart       | 7,376 (7,120–8,215)     | 644 (630–1,455)       |
    | `/`    | document    | 31.3 KB gzip            | 32.2 KB gzip          |
    | recipe | document    | 39.4 KB gzip            | 40.0 KB gzip          |

    The hearts on `/` are on the Library's cards, which come with 06.
