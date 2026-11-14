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
- `expo-video` added (native module: rebuild the dev client). Simulator (iPhone 18 Pro, iOS 27.2, Debug build, local dev server, signed-in as mike): photos, ingredient icons, gallery dots and paging, video poster then playback with pause/mute/fullscreen, Dish Colour tint in light and dark, scroll title, servings stepper and sheet scaling amounts, fractions/decimals, convert to US and back, plan sheet over the page, delete alert with Cancel, share sheet, nutrition ring, rating row, source. A Fabric "unmount a view which has a different index" crash on an ingredient icon was fixed with a non-collapsing slot and five rapid deep-link recipe switches then ran clean. Not seen: Delete confirmed, offline, a recipe with provenance or cookbooks, step photos, tap-to-rate, 4 of 5 light screens beside the boards pixel for pixel; the dev client's floating tools button covers the actions button, so it was dragged away.
- Docs: ticket 30 owns them; nothing written here. Maestro flows (read and scale) run with the set.
