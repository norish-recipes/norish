# 14: Cookbooks

**What to build:** Cookbooks on mobile: the lens, the cookbook page and the whole set of cookbook actions. See `.scratch/mobile-redesign/spec.md` Part 2 ("Cookbooks") and ticket 07's cookbook board.

**Blocked by:** 10

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: the edit flow of `CookbookEditContent` (staged rename, cover and removals in order, `isDirty`, cover off while offline) and the add-recipes picker of `cookbook-add-recipes-panel.tsx`.
- [x] `uploadCookbookImage` takes mobile's `expo-file-system` file as well as a `Blob`.
- [x] Cookbook page: the Library scoped to it under its cover and title, with Remove from cookbook on its cards.
- [x] Create from "+" and from a card's Add to cookbook; rename; delete; add recipes; upload a cover (`expo-image-picker`, library and camera).
- [x] The cookbook page and the picker paint cached data or a skeleton in their first frame; covers load on the device; sheets are glass with no solid footer.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved three flows, not two: the edit flow (`useCookbookEdit`), the add-recipes picker (`useCookbookAddRecipes`) and the Add to cookbook membership flow (`useCookbookMembership`), which the sheet needs too. The web test `mini-cookbooks-save` moved into the hook's test with all four assertions. `uploadCookbookImage` needed no code change: an expo-file-system `File` is a Blob, and a device upload proved it.
- The cookbook page moved into the Recipes stack (`(tabs)/(recipes)/cookbook/[id]`, same URL) so its sheets present over it. Its menu is the native header's. The tab-bar accessory still reads "Add recipe" there, where the board draws "Add recipes".
- The board's cover fade is 58 bands of rising opacity: react-native-svg could not parse the theme colour and no gradient package is installed. Empty states carry no subtext, so the cookbook empty card is the title only.
- Not checked on the device: the camera (a simulator has none), the Cookbooks empty state (it needs the maintainer's cookbooks deleted), offline behaviour, and the final fade (58 bands) after the last build.

### Review log (2026-11-13)

Implementation `393814536..a16cc9b38`, fixes `16616c016..c3d5d6948`. Standards on Sonnet low and Spec on Opus medium; the implementer and two fixers checked on the iPhone 18 Pro in light and dark.

Fixed:
- A cover save wrote the title and version it saw when the upload started, so a rename made elsewhere in that window was overwritten; the hook reads the live cookbook once the upload has finished (web runs the same hook). `16616c016`
- "Take photo" crashed where no camera exists: `expo-image-picker` sets the camera source unguarded and UIKit throws a native exception. The camera is offered only on a real device (`expo-device`), and any picker failure ends in one alert. `2dff429c1`, `c3d5d6948`
- Camera denied shows an alert with the route to Settings. `0511e81a9`
- The cover's fade is one native gradient from the background colour at zero alpha (a transparent start passed through grey); it was 58 stacked views. `210fc28b4`
- An empty cookbook hides the view toggle and Filters; the accessory reads "Add recipes" on a cookbook page and opens the picker. `95ed4a4d8`, `b9fa2a2f5`
- Rename keeps what is typed when the cookbook is renamed elsewhere; the loading sheet renders without handlers. `99b1e0978`, `0516765ab`
- Shared with the Library: the state ladder, the toolbar, the card list's class props; the two pickers on one pick sheet; the page menu on the card-action definitions; `useCookbookTitleEdit`; card actions take the cookbook they run in. `d2d68fb06`, `81880288f`, `396bd5a78`, `81eab8d2e`, `d4e5ef7c5`, `023ee2e42`, `4eef2cf40`
- Web's membership panel has its wiring test back. `1543c5e9f`

Checked, no change needed: an expo-file-system `File` goes into the upload form as a Blob and the link passes the form through, so `uploadCookbookImage` needed no code; web's add-recipes and membership panels match their old code line by line and the deleted web test's four assertions are in the hook's test; web's upload-failure toast keeps its `danger` variant through the adapter; the deleted `cookbook-menu` test's four cases are in the card-actions tests; the main Library is unchanged by the shared card list.

Accepted change on web: an untouched title in the cookbook edit panel follows a rename made elsewhere.

Asked: the Cookbook board draws "Add recipes from any recipe's quick actions menu." under an empty cookbook's title, while ticket 07 records that empty states carry no explanatory subtext. Built without the line until answered.

Not seen on a device: "Take photo" (a simulator has no camera); the Cookbooks lens' empty state (it needs an empty library: ticket 17's throwaway server); offline. During one device run the first press on the New cookbook sheet hung and the simulator was rebooted; ticket 17's cookbook flow repeats that path.

Commit `99b1e0978` does not typecheck alone (`023ee2e42` adds the hook it imports).

Final state `c3d5d6948`: all 11 gates exit 0 with the tests uncached, mobile lint has no warnings. `expo install --check` names the same 11 Expo packages one or two patches behind as before this run; the two packages this ticket added are not among them.
