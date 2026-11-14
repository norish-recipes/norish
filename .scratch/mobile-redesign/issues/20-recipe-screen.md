# 20: Recipe screen

**What to build:** The Recipe screen replacing the `/recipe/[id]` stub. See `.scratch/mobile-redesign/spec.md` Part 3 ("Recipe screen") and the Recipe and RecipeSteps boards.

**Blocked by:** 19

**Status:** open

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
