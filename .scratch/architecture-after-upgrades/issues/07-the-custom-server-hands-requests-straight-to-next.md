# 07: The custom server hands requests straight to Next

**What to build:**

- Norish starts on Node 26 without deprecation warnings.
- A reader who hits an unexpected error sees the error page in their language with a working "Try again". An error in the outermost layout shows a readable page instead of a blank screen.
- Contributors get Next's route types in CI, and page props typed by Next instead of by hand.

See `.scratch/architecture-after-upgrades/spec.md`, The web server.

**Blocked by:** 12, which replaces the bundle with the source run through tsx. The standalone trial moved to 13 with the rest of the image work.

**Status:** ready-for-agent

- [x] The custom server passes each request to Next's handler without parsing its URL first, and the server log shows no DEP0169 on boot or on a request.
- [x] The static file helper, its call and the `mime` dependency are deleted.
- [x] The error page uses the `retry` callback, with copy from the message catalogue in every shipped language.
- [x] A global error boundary renders its own document, with copy chosen by the browser's language and an English fallback.
- [x] `next typegen` runs before type checking in CI and in the local typecheck script. Hand-written `params: Promise<…>` types use Next's generated page, layout and route-context prop types.
- [x] The E2E suite passes against a fresh `pnpm build`.

## Comments

- 2026-10-14. Implemented on `chore/dependency-upgrades`.
  - `http-server.ts` calls `handle(req, res)`; Next parses the URL itself. A production boot (`node --import tsx server/index.ts`) on Node 26 logged no DEP0169 or any other deprecation on boot or on requests to `/login`, `/`, a recipe, a query string with a non-ASCII character, `/api/v1/health/ready` and `/serwist/sw.js`.
  - The static helper never served anything (its exclusion list held `/`), so deleting it changes nothing: `public/` files are served by Next as before. `mime` went with it.
  - `error.tsx` is the Nora card with the `retry` callback (Next 16.4 passes `retry`; `reset` only re-renders). Copy is `common.errorPage` (title, message, retry) in all 16 locales.
  - `global-error.tsx` renders its own `<html>`: the root layout's locale and message provider are gone there, so it picks the first catalogue locale matching `navigator.languages` (with `de`, `nb`/`nn` and `pt` mapped to the catalogue's codes), loads only that locale's `common` section through the new `loadMessageSection`, and falls back to English. Unit test: `apps/web/__tests__/app/global-error.test.tsx`.
  - The typecheck script runs `next typegen` first, and CI runs that script. Pages use `PageProps<"/route">` (or `Pick<…, "params">` where a page reads only params) and route handlers `RouteContext<"/route">`. With Next's types, `searchParams` values are `string | string[]`, so login and signup take `callbackUrl` only when it is a single string.
  - The full browser suite passed against a fresh build: 181 of 181, no flaky test (2026-10-14, together with ticket 10).
  - **After review:** the global error page reads in English until the reader's language loads, and keeps English when it cannot load (a lost network or a chunk that will not load is a likely cause of an error this far out), so it is never blank.
