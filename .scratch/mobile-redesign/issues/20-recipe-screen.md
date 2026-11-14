# 20: Recipe screen

**What to build:** The Recipe screen replacing the `/recipe/[id]` stub. See `.scratch/mobile-redesign/spec.md` Part 3 ("Recipe screen") and the Recipe and RecipeSteps boards.

**Blocked by:** 19

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: `use-system-conversion` (`useAutoConversion`), `use-amount-display-preference`.
- [x] Sections in the board's order (Notes, Ingredients with tick and Add to groceries, Steps, rating, In cookbooks, Nutrition, Provenance, Source), Hidden Items respected.
- [x] Servings, metric/imperial, favourite, plan, share, AI actions (when AI is on and permitted), delete with the native alert.
- [x] Media: photo, gallery, video.
- [x] Dish Colour tint; first frame from the Warm Set or a skeleton; writes through the Outbox.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-14: `useAutoConversion` and `useSystemConversion` moved together (the menu needs the options; they carry a `labelKey` the platform translates), `useAmountDisplayPreference` first; each with its tests in shared-react and web switched in its own commit. The page's recipe moved into the Recipes stack as `recipe/[id]/` with its own nested stack, so the Servings and Share sheets share one `RecipePageProvider`; the tab bar and Add recipe accessory hide while it is mounted (`useHideTabBar`). `use-card-actions`, `use-confirm` and `RoundTick` moved to the shared folders, as a feature may not import another.
- Header: the native back, favourite and actions menu (AI as a submenu when AI is on and the reader may edit). Edit, Cook, the bottom Home/Cook bar and Recipe Timer chips are left out: the editor is ticket 23, cook mode and timers ticket 21. Share lists status and dates only, as the server keeps no link's address after creating it, so only the latest link has a URL (Copy/Open). Step photos open in a plain full-screen pager; ingredient/step markdown shows as plain text.
- `expo-video` added (native module: rebuild the dev client). Simulator (iPhone 18 Pro, iOS 27.2, Debug build, local dev server, signed-in as mike): photos, ingredient icons, gallery dots and paging, video poster then playback with pause/mute/fullscreen, Dish Colour tint in light and dark, scroll title, servings stepper and sheet scaling amounts, fractions/decimals, convert to US and back, plan sheet over the page, delete alert with Cancel, share sheet, nutrition ring, rating row, source. A Fabric "unmount a view which has a different index" crash on an ingredient icon was fixed with a non-collapsing slot and five rapid deep-link recipe switches then ran clean. Seen on the simulator in the fix round (2026-11-14): Delete confirmed on a throwaway recipe (back on the list, row gone); tap-to-rate (4 stars set, same star clears); a recipe in a cookbook (In cookbooks chip and Manage); the page opened with the server stopped from the Warm Set, a favourite queued there and replayed once the server returned; Add to groceries opens at the page's 5 servings; deep links to /recipe/[id] from the Calendar tab and over the Add recipe sheet end on the Recipe screen in the Recipes tab with a working back, and the tab bar is back on Calendar with a recipe left open; Keep screen on toggles with a tick; step and ingredient links render and a link opens Safari; the nutrition credit line reads on a worked-out recipe (Hermes has no Intl.ListFormat, so the names are comma-joined). Not seen: step photos (no recipe in the dev library has any), the import and realtime toasts' View action (an import could not run here: the browser needs a token) and the Share Extension hand-off, which imports in place and never navigates; both toasts go through the same `toRecipe` push as a deep link; 4 of 5 light screens beside the boards pixel for pixel; the dev client's floating tools button covers the actions button, so it was dragged away.
- Docs: ticket 30 owns them; nothing written here. Maestro flows (read and scale) run with the set.
- 2026-11-14 (re-review fixes): the tab bar stays hidden under the page's Add to groceries, Plan and Add to cookbook sheets (seen on the simulator, bar gone under all three, list unchanged); inline markdown follows CommonMark for spaced stars, balanced parentheses, `\*`/`\_` escapes and mailto; links are off on ticked steps and ingredients; each page holds its own keep-awake tag; the nutrition credit uses `intl.formatList` through a new `@formatjs/intl-listformat` polyfill beside plural-rules (app launches with it; the credit itself not seen, no dev recipe has a worked-out one, unit tests cover en and nl).

### Review log (2026-11-14)

Range `6d285b3db..b37563f25`. Standards on Sonnet low, Spec on Opus medium; fixes `85dee6287..98d92c2de`, re-reviewed on Opus medium, second round `4c16bc715..b37563f25`.

Fixed, first round (11): Add to groceries opening at the stored servings instead of the page's; the tab bar hidden by mount (it stayed hidden on other tabs); the nutrition credit line and its household-numbers case (one `workedOutSources` for web and mobile); Keep screen on in the menu; links, bold and italic in steps and ingredients; one step photo list; one theme-token colour hook for every caller; `more-sections.tsx` split by section with `storedNutrition` in utils and tested; the Dish Colour hue and chroma clamp shared with web and the tint factors named; the simulator checks the implementer had not reached. Routes from outside the Recipes tab were checked and needed no fix.

Fixed, second round (6): the tab bar returning under Add to groceries, Plan and Add to cookbook opened from the Recipe screen; a spaced `*` turning italic; `mailto:` links, parentheses in a URL and backslash escapes; links off on a ticked step or ingredient, as on web; one keep-awake tag per page, so a recipe under another cannot drop its hold; the credit's names joined with `formatList` on a `@formatjs/intl-listformat` polyfill beside plural-rules.

Rejected (2): folding the ingredient icon's inner component into its parent (the split is there because the icon hook is conditional); web turning the wake lock off when the browser releases it (iOS releases nothing, so the choice holds while the page is open).

Open for ticket 30's device run: the nutrition credit line with the list-format polyfill (not seen after the second round; unit tests cover en and nl); step photos (no recipe in the dev library has any); the import and realtime toasts' View action.

Final state `b37563f25`: all 11 gates exit 0, mobile lint without warnings.
