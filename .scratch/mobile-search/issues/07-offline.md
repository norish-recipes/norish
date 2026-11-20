# 07: Search while Offline

**What to build:** Search's Offline behaviour, per the spec.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] Discover sections show from the Offline Cache (whatever was last fetched); Recent Searches are local anyway.
- [x] Typing shows no suggestions; the Search Scope row stays.
- [x] A confirmed search shows a card saying search needs a connection where results would be, and runs when the app is Live again.
- [x] Tests for the Offline state choice; i18n in every locale; gates green.

## Comments

Implementation (2026-11-20):
- Source of truth: `useConnectivity().isOffline` (shared-react offline), read once in the screen and in Discover; no new check. Queries are not paused (backend-unreachable is not `onlineManager`), so the rules take `offline` as input: `searchView` gains `offline` + `cached` (new `hasData` on `useLibraryQuery`) and an `"offline"` view; `discoverSections` hides a loading section Offline.
- Results already held for exactly this query stay visible Offline (the Recipes tab serves its cache the same way), including a cached empty answer; nothing held shows the card. The list read is disabled Offline and enabled again Live, so the search runs by itself when the app is Live; no query is cancelled.
- Card: the warning `NoResultsCard` in Results' place (chips stay), cloud-offline icon, one new string `recipes.search.offline` "Search needs a connection" in all 18 locales. Typing returns no recipe or Narrow-to rows and no skeletons Offline; Search for and the Scope row stay. Recent Searches are untouched by connectivity.
- Not done: no component test of the screen and nothing seen on a device (pass follows).

