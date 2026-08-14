# 04 — Settings flicker: trace before fixing

Status: ready-for-human
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

## Answer

Traced 2026-08-14 on the dev stack (admin account `mike@vanes.dev`), headless Chromium 1440×900 and 390×844, via a rAF + MutationObserver state recorder plus a CDP screencast. Two different navigations exist, and they flicker differently.

### Desktop user-menu item: it is a full document load

`navbar-user-menu.tsx:211` gives the Settings `Dropdown.Item` a bare `href`. No React Aria `RouterProvider` is wired anywhere in `apps/web`, so HeroUI/RAC renders that as a native `<a>` — the browser does a **hard navigation** (confirmed: one `load` event fired; every sibling item uses `onPress` + `router.push` instead). Screencast sequence after the click (dev-stack timings, click at t+0):

1. t+~170ms — **blank page** (document unloaded, ~500ms of nothing but the background color)
2. t+~670ms — SSR settings HTML: title + tab list (Admin tab already present — the server-derived tab from f1126d0e works) + panel skeletons; navbar is the bare SSR shell without the avatar
3. t+~800ms–1.2s — hydration fills in the navbar avatar, then the panel content replaces the skeletons

So on desktop the "load, flicker, load again" is mostly *the entire app rebooting*: blank flash → skeleton page → content, ~1.2s+ on a warm dev stack.

### Client-side navigation (mobile nav `NextLink`): three painted states, not four

With a real client navigation the observer recorded (~450ms total, dev stack):

1. t+~200ms — `loading.tsx` `SettingsSkeleton`: full-page skeleton, **no chrome** (no h1, no tab list) — painted for only ~30ms
2. t+~230ms — page mounts: h1 "Settings" + tab list (Admin included from first paint) + the `dynamic()` loading `SettingsSkeleton` in the panel — painted ~320ms
3. t+~550ms — panel content

The predicted frame 2 (the page-level `Suspense` bare-text `"Loading..."` fallback) **never paints** on client navigation — `useSearchParams` doesn't suspend there. The string was found only inside a streamed RSC `<script>` payload (an earlier probe that flagged it as a painted state was a false positive from `document.body` text scanning). It would paint on SSR/streaming, but on a hard load the browser is showing the blank/SSR states at that time anyway.

The flicker on client nav is therefore: skeleton **without** chrome → layout-shifting swap to chrome + a *second* skeleton → content. Two skeleton pops with a chrome jump between them.

### The old admin-tab remount

Gone before this trace: `page.tsx` is now a server component and the tab list renders with the Admin tab from the first settings paint (both traces confirm). No remount jump was observed.

### Decision put back to the maintainer

Both grilling options remain viable; evidence says the fix has two independent halves:

- **(a) Kill the hard navigation:** wire the desktop menu item to the client router (either `onPress` + `router.push` like its sibling items, or an app-wide React Aria `RouterProvider` so every HeroUI `href` becomes a client navigation). Without this, no skeleton strategy matters on desktop — the blank-flash reboot dominates.
- **(b) Pick the skeleton strategy** for the client navigation:
  - **Instant chrome + single panel skeleton** — drop `loading.tsx` (or reduce it to chrome + panel skeleton) so the h1/tab list paint immediately and only the panel shows one skeleton until the chunk + data arrive; or
  - **Whole-page single skeleton** — keep `loading.tsx` as the only skeleton and remove the `dynamic()` loading skeletons, accepting a full-page skeleton until content is ready.

The trace makes (a) unconditional and favors *instant chrome + single panel skeleton* for (b): the chrome is server-derivable and cheap (it painted 30ms after the route skeleton), so the full-page skeleton frame buys almost nothing and causes the layout jump. Awaiting the maintainer's call; the fix is a follow-up ticket.

## Comments

- 2026-08-14: Stub removal done ahead of the trace (three `page.tsx` files deleted; component/context directories untouched). Verified no internal links and no test references before deleting.
- 2026-08-14: Trace recorded and documented above; status → ready-for-human for the acceptance-criterion decision. Raw frame logs and screencast PNGs were kept in the session scratchpad only (they show personal dashboard content); the state sequences above are the condensed, deduplicated observer output.
