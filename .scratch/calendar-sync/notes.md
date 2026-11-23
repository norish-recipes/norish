# Calendar sync (seed for its own spec)

Status: needs-triage

Split out of the mobile settings spec on 2026-11-23. Nothing here is built. Decisions so far, to re-check when this is specced:

- **Apple Calendar Sync** on iPhone, one way, replacing CalDAV setup there (CalDAV stays on the web). It is a row in Settings, not a button on the Calendar tab.
- It writes into one shared household "Norish" calendar in iCloud (full calendar access, created by the first member, shared from Apple Calendar, picked by the others). Every member's iPhone writes into it, keyed by Planned Item, so a meal planned on any iPhone shows for everyone; a meal planned on the web waits until an iPhone opens Norish (open, realtime while open, best-effort background refresh; no push relay).
- Covers what is planned from the day it was first turned on; past events stay.
- Event = recipe name or note text, plus a link to the recipe on the server.
- Turning it off, or signing in as another account, stops that phone writing; it never deletes the shared calendar.
- **Meal times** move from each person's CalDAV config to the household (household settings; the user's own when they have no household), used by both syncs. On upgrade a household takes its most recently edited member's CalDAV times, else the web form's defaults 07-08 / 12-13 / 18-19 / 15-16 (the DB column defaults 08-09 / 15-15:30 disagree).
- **CalDAV Sync should be household-wide.** Today it is not: `packages/api/src/caldav/event-listener.ts` syncs a Planned Item only to the CalDAV config of the member who planned it (`item.userId`), at that member's times. `getUniqueCalDavServers` (`household-deduplication.ts`, present since 0.17) suggests household sync was intended but has no caller; whether it ever worked is unconfirmed.
- Canvas: the Apple Calendar boards drawn in v116 (Calendar-tab entry, sheet states) were rejected; redraw as a Settings row.
