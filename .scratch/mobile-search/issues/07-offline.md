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


Fix round (2026-11-20):
- One rule: the screen draws `searchView`'s page (Offline card only for "offline"; held results, even an empty answer, stay as Results or the real no-results page). `held` replaces `cached`; `showsResults` takes only text, confirmed and chips. A new `useSearchResults` holds the list and the rule; the screen has no `isOffline` branch and an in-flight read no longer beats the card.
- Reconnect: the search query is no longer toggled with `enabled`; Recovery's `refetchQueries({ type: "active" })` is the only mechanism (tests showed held results fetched twice with the toggle, once now, also over flaps). Typing suggestions read connectivity inside the hook and ask nothing Offline.
- `useLibraryQuery.loadMore` fetches nothing Offline, so the Recipes tab and Search share it; Live behaviour is unchanged. The Offline card is a neutral `EmptyCard` tone (muted ground and ink, cloud-offline icon); no Calendar capsule exists in the repo to copy, so it follows the avatar's Offline wording only.
- Device (iPhone 18 Pro, iOS 27.2, Release, light and dark): rested, focused, Recent (10 kept of 11, Clear, ↖ unconfirmed), chip tap and ×, delete showing in Categories, Offline discover from cache, typing, card, held results, and card replaced by Results on reconnect all pass. Nothing needed fixing.
- Not checked on the device: sign out/in and a second account for Recents, Hidden Items hiding Favorites and "4 and up", fresh-install-Offline, Narrow to an Ingredient and match lines. Board deviations: only the accepted ones. Typing suggestions on reconnect were not counted (only the results query is).
