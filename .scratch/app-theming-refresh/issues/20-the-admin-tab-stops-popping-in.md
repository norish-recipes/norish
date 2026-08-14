# 20 — The Admin tab stops popping in

**What to build:** An administrator opening settings sees the Admin tab in the tab list on the very first paint. Today the tab list renders without it and it appears once a round trip to the server answers a "what is my role?" query — the tab pops in noticeably late, and a warm five-minute query cache makes the delay look intermittent rather than constant.

The round trip is unnecessary: the session the server already resolves for every page carries the server-owner and server-admin flags, and the client cannot write those fields. Settings gains a thin server pass that reads the session and hands the role to the page, the same shape the dashboard uses to read its session today. The gate stops waiting on any fetch, and the role query that existed only to drive it goes away.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Signed in as an administrator or owner, the Admin tab is present in the first painted tab list; it never appears after the fact.
- [x] Signed in as a regular member, the tab is absent and nothing ever fetches a role to decide that.
- [x] Deep-linking to the admin tab lands an administrator on it directly, and falls back to the default tab for anyone else, with no intermediate state.
- [x] The role query that existed only to show or hide the tab is gone. Every admin procedure still enforces its own server-side authorisation — hiding the tab was never the security boundary and still isn't.
- [x] The admin panel itself may still load lazily when selected; what may not happen is the tab list changing shape after first paint.
- [x] The settings suite drives tab presence from the session role in both directions, and the remaining settings tests pass untouched.

## Comments

- Shipped. `settings/page.tsx` became the thin server pass (same shape as the dashboard's): it reads `auth.api.getSession`, derives the role from the session user's `isServerOwner`/`isServerAdmin` fields (client-unwritable, `input: false`) with the same cast the tRPC context uses, and hands `showAdminTab` to the moved client component (`components/settings-page-content.tsx`). The tab list is static for the page's lifetime, so the Tabs.List remount-key workaround for the pop-in went away with the pop-in. Deleted end to end: `useUserRoleQuery` (web re-export and shared-react factory), the `admin.getUserRole` procedure, and the now-orphaned `getUserServerRole` repository function plus their test scaffolding. New `settings-page.test.tsx` drives tab presence and admin deep-linking from the session role in both directions; the rest of the settings suite passed untouched.
