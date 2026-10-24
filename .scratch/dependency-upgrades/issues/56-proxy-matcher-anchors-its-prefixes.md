# 56 — The proxy matcher anchors its prefixes

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 6.

## What to build

The matcher in `apps/web/proxy.ts:56` skips the auth proxy for paths that start with any of its prefixes (`login`, `signup`, `trpc`, `icons`, `robots`, `auth-error` and others). A prefix has no boundary after it, so a future `/login-history` or `/icons-admin` would skip the proxy and be public.

1. End each prefix at a path boundary: a directory prefix matches only itself or what is under it, and a file matches exactly.
2. `/serwist/` must stay excluded; the service worker scripts fetch without credentials.

## Acceptance criteria

- [x] A test proves `/login`, `/login/`, `/icons/x.png` and `/sw.js` skip the proxy, and `/login-history`, `/icons-admin` and `/sw.json` go through it.
- [x] The offline E2E project passes, which shows the service worker still registers.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
- 2026-10-14 (implemented) — The matcher's negative lookahead now has two halves: the directories (`api/auth`, `api/trpc`, `api/v1`, `trpc`, `_next`, `icons`, `ingredient-icons`, `images/splash`, `login`, `signup`, `auth-error`, `~offline`, `serwist`, `sounds`) followed by `(?:/|$)`, and the files followed by `$`. The old bare `robots` prefix became the file `robots.txt`. `proxy.test.ts` checks `/login`, `/login/`, `/icons/x.png`, `/sw.js`, `/serwist/sw.js` and `/api/auth/session` skip the proxy and `/login-history`, `/icons-admin`, `/sw.json`, `/api/v10` and `/trpc-console` go through it (all five of the latter were skipped before). The same paths give the same answers through Next's own compiled matcher (`getMiddlewareMatchers`), which tests the pathname only.
  - The offline E2E project runs with the branch's E2E pass at the end of this batch; its result is recorded here.
- 2026-10-14 (review fixes) — the full `pnpm test:e2e` passed 175 of 175 (ai 143, offline 23, realtime 9) against a build of the review fixes.
