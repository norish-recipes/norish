# 04 — Settings flicker: trace before fixing

Status: ready-for-agent
Type: research

**What to do:** The maintainer sees `/settings` "load, flicker, and load again" and chose diagnosis before any fix. Record what actually renders: a performance trace / frame capture of navigating to `/settings` on the dev stack (admin account — the admin role query is part of the suspected sequence).

Code reading predicts four frames to confirm or refute:

1. `loading.tsx` renders `SettingsSkeleton` during navigation.
2. The page's `Suspense` fallback replaces it with a bare text div (`useSearchParams` suspends) — `apps/web/app/(app)/settings/page.tsx:149`.
3. The tab panel's `dynamic()` import shows a second `SettingsSkeleton` while the chunk loads.
4. The Admin tab pops in after the role query and deliberately remounts the tab list (`key` hack at `page.tsx:106`), jumping the chrome.

Also check whether the navbar link causes a full remount beyond these.

**Also part of this ticket (maintainer decision, 2026-08-14):** the `/settings/user`, `/settings/household`, and `/settings/caldav` redirect stubs (`page.tsx` files containing only `redirect("/settings?tab=…")`) are removed. Nothing internal links to them and no test navigates to them; old bookmarks 404, accepted. The directories stay — they house the tab components and contexts. If the flicker fix later inverts to path-based tab routes, those paths return as real pages.

**Done when:** the stubs are gone, the actual frame sequence is documented here (trace attached or frame timings listed), and the acceptance-criterion decision — instant chrome + single panel skeleton vs whole-page single skeleton, per the grilling options — is put back to the maintainer with the evidence. The fix itself is a follow-up ticket, not this one.

## Comments

- 2026-08-14: Stub removal done ahead of the trace (three `page.tsx` files deleted; component/context directories untouched). Verified no internal links and no test references before deleting.
