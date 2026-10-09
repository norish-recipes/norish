# 02: Device Preferences work Offline

**What to build:** A reader who is Offline keeps their Device Preferences. Opening Norish Offline on a page it never visited draws that page with the reader's stored choices for this Device Kind. Changing a choice Offline applies at once and lands on the profile once Live again. A page the service worker serves from its cache, saved before the last change, settles on the profile's current choice. It is proven on the grocery view and grouping from 01; every preference 03 moves inherits it. See `.scratch/device-preferences/spec.md`.

**Blocked by:** 01

**Status:** done

- [x] The profile query joins the Warm Set.
- [x] With no server pass (Offline start-up), the provider works out the Device Kind in the browser with the shared rule and reads that kind's block from the persisted profile query. The bootstrap already waits for the restored cache, so nothing paints with the defaults first.
- [x] A change made Offline applies at once and waits in the Outbox. Its Replay lands on the Device Kind it was made on.
- [x] After hydration the profile query wins whenever it disagrees with what was painted. That covers HTML the service worker served from its cache, and a reload while a change still waits in the Outbox.
- [x] An API test proves that replaying the same Device Preference write is harmless.
- [x] Offline browser tests prove that:
  - [x] a change made Offline applies at once and is on the profile after Live;
  - [x] a page served from the service worker's cache settles on the profile's current grocery view;
  - [x] Offline start-up on an unvisited route draws the stored grocery view.
