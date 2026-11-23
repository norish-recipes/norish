# 01: Settings root, entry and App section

**What to build:** Replace the Settings tab with a pushed Settings page opened from the avatar menu's "All settings", drawn as `StPage` `screen=root`. Build the shared settings list pieces the later tickets use: grouped section, settings row with swipe actions and long-press menu (`native-menu`), sub-page nav title, offline disabling. Fill the App section and Sign out. Add the privacy page to the landing site.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] `(tabs)/settings.tsx` removed; Settings is a pushed route with a back button, reached from "All settings" on every tab.
- [ ] Root sections drawn per the canvas; Profile, Household and Connections rows navigate to placeholder sub-pages the later tickets fill.
- [ ] Shared settings row: swipe actions (34 pt circles, 11 pt labels, content shrinks with ellipsis) and long-press glass menu with icons, colours per the spec.
- [ ] App section: Server opens the server-address flow; Privacy policy and Support open the browser; Version shows app version and build plus the server version.
- [ ] Sign out and change server confirm only with unsynced Outbox changes ("Discard unsynced changes?"), unit-tested rule.
- [ ] Offline: cached data shows, actions disabled, Offline capsule shown.
- [ ] `norish.dev/privacy` page on the landing site, linked from the landing footer.
- [ ] Gates green.

## Comments
