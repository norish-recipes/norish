# 03: Render-count script and the groceries baseline

**What to build:** A committed script next to `apps/web/scripts/measure-page-loads.ts` that counts, per scripted action, mounts and re-renders per component and the prop that changed, through the React DevTools hook on a dev build (so components have names). The groceries scenario runs these actions: check an item, add an item, open the edit panel, switch the view mode, and a realtime echo from a second client changing an item. `measure-page-loads.ts` also reports the JS a page downloads, since Next 16 dropped route sizes from `next build`. Two baselines are taken: one on the current code before 01, and one after 01 and before 04, so the groundwork's rewrite of Device Preferences, which the view-mode action reads, shows apart from the pilot. See `.scratch/app-structure/spec.md`, "Measurement".

**Blocked by:** None for the script and the first baseline; 01 for the second baseline

**Status:** done

- [x] The script takes a scenario and prints, per action, mounts and updates per component, sorted by count, with the changed props behind each update.
- [x] The groceries scenario covers the five actions, the echo coming from a second signed-in browser context.
- [x] Two runs on unchanged code give the same counts.
- [x] `scripts/README.md` says how to run it in a few lines.
- [x] `measure-page-loads.ts` reports the JS bytes each page downloads, added up from its script responses.
- [x] Both baselines are recorded under `## Comments` here: per-action renders, `/groceries` first paint and downloaded JS from `measure-page-loads.ts`, and the code shape (folders groceries spans, lines in web, mobile and shared-react, binding files).

## Comments

### Measurement setup

Every baseline, and 07's after numbers, reuse this.

- **Data set**: the one `measure-renders.ts` writes through the API at the start of every run (`resetGroceries`). Four Stores: Albert Heijn (aisles Produce, Dairy, Bakery), Lidl (Produce, Frozen), Butcher, Farmers market. 45 rows: 24 groceries under the Stores and 4 under none, 4 recurring (milk and eggs weekly, coffee beans and bin bags monthly), and all 13 lines of three recipes (Spaghetti bolognese, Green curry, Pancakes) with no Store. 4 rows are done, 6 have a by-hand price, 12 are filed under an aisle. Stores, prices, aisles and recipes are made once and kept; groceries are replaced every run. Each Store numbers its groceries from 0, and the server breaks a sortOrder tie no Store first, then by Store and id (11269853c), so the list comes back in one order.
- **Server**: a fresh `norish_measure` database in `norish-db-local`, migrated and seeded by its first boot, AI off, owner `mike@mike.nl` / `mikemike` signed up first. From `apps/web`, with the root `.env.local` plus `DATABASE_URL=…/norish_measure VALKEY_URL=redis://localhost:6379/4 PARSER_API_PORT=8401 AUTH_RATE_LIMIT_ENABLED=false` and `PORT`, `AUTH_URL` and `TRUSTED_ORIGINS` on the port: the dev server on :3401 (`node --import tsx server/index.ts`) for renders; `next build`, then the same with `NODE_ENV=production UPLOADS_DIR=$PWD/.runtime/uploads` on :3400 for page loads.
- **Renders**: `pnpm --filter @norish/web run measure:renders groceries --base http://localhost:3401 --email mike@mike.nl --password mikemike`. A Pixel 7, grouping set on through the API before the page opens, By Store picked in the page. Actions in this order: check "cucumber" (Albert Heijn), add "paprika" (the press of Add in the open panel), open "tomatoes" for editing, a second signed-in phone checks "carrots" (Lidl), switch to By Recipe.
- **Page loads**: `pnpm --filter @norish/web run measure:page-loads --base http://localhost:3400 --email mike@mike.nl --password mikemike --only /groceries`, straight after a renders run (the data set plus "paprika", with "cucumber" and "carrots" checked), service worker blocked. Two sets of 15 runs on a fresh production build, at an `uptime` load average under about 3: the first warms the server up and stays off the record, the second is recorded.
- **Code shape**: groceries with stores and the Pantry, `.ts`/`.tsx` under git, tests apart. Web: `app/(app)/groceries/`, `components/groceries/`, `hooks/{groceries,stores,pantry}/`, `components/Panel/consumers/{add-grocery-panel,edit-grocery-panel,mini-groceries,recurrence-panel}.tsx`, `components/skeleton/grocery-skeleton.tsx`, `context/pantry-realtime-context.tsx`, `hooks/use-recurrence-detection.ts`. Mobile: `src/hooks/groceries/`. shared-react: `src/{contexts,hooks}/{groceries,stores,pantry}/`, `use-grocery-form-state.ts`, `use-recurrence-detection.ts`.
- **Binding files**, in web and mobile: a file that calls a groceries, stores or Pantry `create*Hooks` or `create*Context` factory, or `createUseRecurrenceDetection`, plus every file that imports straight from a `create*Hooks` caller (one hop). Mobile's `index.ts` barrel is one; web's barrels import the per-hook files, so they are not. Files that import a context or `useRecurrenceDetection` are app code.
- **Unit tests**: every `.ts`/`.tsx` file in web's `__tests__/{app/groceries,components/groceries,hooks/groceries,hooks/stores}/` (22 files, `test-utils.tsx` among them), and shared-react's `pantry`, `store-aisles` and `store-prices-pending` suites (`__tests__/*.test.tsx` until 04 moves them).

### Baseline 1 (before 01, at 591d0aa73)

App code as at d0fa9f86a plus the sortOrder tie-break (11269853c); 02's commits change no runtime code. Re-taken on the fixed script (answers in the order asked, joined timers): nine runs printed byte-identical output, among them one after a dev-server restart, one beside the packages/db suite and one beside `next build`, and eleven more with commit logging added matched them. The full per-component output is [`baselines/1-before-01.txt`](../baselines/1-before-01.txt).

**Renders per action**

| Action                                          | Baseline 1: mounts / updates / commits |      Baseline 2 | After the pilot |
| ----------------------------------------------- | -------------------------------------: | --------------: | --------------: |
| Check an item                                   |                            0 / 288 / 7 |     0 / 288 / 7 |               — |
| Add an item                                     |                        19 / 1,689 / 12 | 19 / 1,689 / 12 |               — |
| Open the edit panel                             |                          178 / 224 / 8 |   178 / 232 / 8 |               — |
| Realtime echo of another phone checking an item |                            0 / 247 / 2 |     0 / 247 / 2 |               — |
| Switch the view mode                            |                         853 / 696 / 11 |  853 / 728 / 10 |               — |

| Action               | Baseline 1: top three (mounts + updates, what changed)                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Check an item        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; React Aria DOMElement 13                |
| Add an item          | SortableGroupItem 164 (children 122, (context) 81, group 52); React Aria DOMElement 137; bound DOMElement 108 |
| Open the edit panel  | Presence 26; React Aria DOMElement 25; Primitive.div 21                                                       |
| Realtime echo        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; motion.div 10                           |
| Switch the view mode | React Aria DOMElement 206; bound DOMElement 160; React Aria provider 113                                      |

Our own components behind those numbers:

- Check and echo: all 40 group rows (`SortableGroupItem`) render twice on a context change, and every Store section once, for one checked row.
- Add: the optimistic row (437 components, then 94 in the commit after it), the create's answer (503) and its socket event (487) each re-render the list. `GroupedGroceryItem` renders 69 times, 52 of them for a new `group` object: the create moves every no-Store grocery one sortOrder down, so the 17 no-Store groups (18 with paprika) are new in each of those three commits, while the Stores' groups keep theirs. The Add panel renders twice (58 and 57 components): on the press, and when its two 400 ms lookups settle. The page also fetches `config.units`, `ingredients.icons` and `stores.aisleLinks` (twice in one batch) again.
- Switch the view mode: By Recipe mounts 40 `GroceryItem`s, and each renders once more on a context change.

**`/groceries` page load** (15 runs, median and spread)

|                       |            Baseline 1 |            Baseline 2 | After the pilot |
| --------------------- | --------------------: | --------------------: | --------------: |
| First paint           |      632 ms (624–672) |      624 ms (624–632) |               — |
| Price and aisle drawn |      632 ms (624–672) |      624 ms (624–632) |               — |
| Document              |          42.5 KB gzip |          42.6 KB gzip |               — |
| JS downloaded         | 894 KB gzip (894–894) | 900 KB gzip (900–900) |               — |

**Code shape**

|                           |                              Baseline 1 |                              Baseline 2 | After the pilot |
| ------------------------- | --------------------------------------: | --------------------------------------: | --------------: |
| Web                       |                  99 files, 10,317 lines |                  99 files, 10,308 lines |               — |
| Mobile                    |                       2 files, 47 lines |                       2 files, 26 lines |               — |
| shared-react              |                   27 files, 2,911 lines |                   27 files, 2,911 lines |               — |
| Folders (with subfolders) |    web 9 (14), mobile 1, shared-react 6 |    web 9 (14), mobile 1, shared-react 6 |               — |
| Binding files             | web 20 (303 lines), mobile 2 (47 lines) | web 20 (299 lines), mobile 2 (26 lines) |               — |
| Unit tests                |                   25 files, 6,974 lines |                   25 files, 6,991 lines |               — |

Web's folders: `app/(app)/groceries` (+`components`, `pantry`), `components/groceries` (+`dnd`, `pantry`, `stores`), `hooks/groceries`, `hooks/stores`, `hooks/pantry`, `components/Panel/consumers`, `components/skeleton`, `context`, `hooks`. shared-react's: `contexts/groceries`, `contexts/stores`, `hooks/groceries`, `hooks/stores`, `hooks/pantry`, `hooks`.

Also seen: every dev load of `/groceries` logs a hydration attribute mismatch, dnd-kit's `aria-describedby="DndDescribedBy-N"` counter differing between server and client. React leaves it unpatched, so it adds no renders.

### Baseline 2 (after 01, before 04)

At 2696c4a86, with the setup above. Two renders runs printed byte-identical output, [`baselines/2-after-01.txt`](../baselines/2-after-01.txt). A third with each `(state)` labelled by the hook behind it, and one against the production build, gave the same counts. The page loads are the second of two 15-run sets on the production server, at a load average near 2; the first, on the just-started server, had one cold load of 3,180 ms and a 628 ms median.

| Action               | Baseline 2: top three (mounts + updates, what changed)                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Check an item        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; React Aria DOMElement 13                |
| Add an item          | SortableGroupItem 164 (children 122, (context) 81, group 52); React Aria DOMElement 137; bound DOMElement 108 |
| Open the edit panel  | React Aria DOMElement 26; Presence 26; Primitive.div 21                                                       |
| Realtime echo        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; motion.div 10                           |
| Switch the view mode | React Aria DOMElement 224; bound DOMElement 162; React Aria provider 125                                      |

What changed against Baseline 1, component by component:

- Check, add and echo render the same components the same number of times; only reasons moved. `useUnitFormatter` (every row with an amount) and `IngredientIconsProvider` now each hold a `user.getDevicePreferences` query, whose snapshot moves without a render while the choice stays the same. The "By Store" pick before the actions writes the choice and reads it again (`dataUpdatedAt`), so the next render records `(state)`: `IngredientIconsProvider`'s one update in check, and the first of the three passes of the 17 no-Store `GroupedGroceryItem`s in add. Their other two passes see the `config.units` re-fetch start and answer, where Baseline 1 marked one pass: `(state)` 17 becomes 51 of the same 69 updates.
- Open the edit panel, 8 more updates: the closed View Mode menu in `GroceriesListActions` renders once more (DropdownRoot, DropdownPopover, Popover, its Button and four React Aria parts). `GroceriesUiProvider` renders for `setEditingGrocery` as before, but `useDevicePreference` now returns a new setter on every render, so the items' `onPress={() => setViewMode("store")}` change and the compiled menu no longer bails out.
- Switch the view mode, 32 more updates (56 gone, 88 added) and one commit fewer.
  - Gone: the 40 `GroceryItem` updates after mounting, and 16 elsewhere. `useUnitFormatter` and `IngredientIconsProvider` read the old provider's context, which changed again when the write settled; each now selects its one choice, which did not change. The old provider (3 updates) also wrote the change onto `user.get` and read `user.get` again, which rendered the profile's readers: `OfflineStatusModal` 4, `NavbarUserMenu` 2, `TimerDock` 2, and `UserProvider`, `WebUserProviderInner`, `PermissionsProvider` and `OfflineCacheController` 1 each. The write and the read again now go to `user.getDevicePreferences`, which only `useDevicePreference` readers hold. The commit gone is the old provider's third render, for that read's answer (it read `dataUpdatedAt`); an equal answer now renders nothing.
  - Added: `GroceriesUiProvider` renders twice in both, at the pick and when the write settles. Its second render now hands out new setters for the same choices, so `GroceriesPage` and `GroceriesListActions` render twice instead of once, and the open View Mode menu renders again: items, collection, popover and the "Group similar" switch (`DropdownItem onPress 3`, `UiSwitch onValueChange 1`).

The 8 and the 88 have one cause: `useDevicePreference` builds `trpc.user.getDevicePreferences.queryKey()`, a new array, on every render, and the React Compiler keys the setter on it. A stable setter would remove both; that is a change to `reader/device-preferences.tsx`, not made here.

Page loads: first paint 8 ms faster at the median, inside Baseline 1's spread. Document +0.1 KB: the seed is now the `user.getDevicePreferences` query with both Device Kinds' blocks, where it was this kind's values. JS +6 KB gzip, not traced.

Code shape: 01 moved or deleted none of the counted files (its moves are config, tRPC, the platform adapter and Device Preferences), so every path is Baseline 1's. Binding files are the six factory callers (`shared-{groceries,stores,pantry}-hooks.ts`, `use-recurrence-detection.ts`, the groceries and stores contexts) and the 14 per-hook files re-exporting what they built, not the `index.ts` barrels, plus mobile's two. Unit tests are web's `__tests__/{app/groceries,components/groceries,hooks/groceries,hooks/stores}/` and shared-react's `pantry`, `store-aisles` and `store-prices-pending` suites. Web loses 9 lines and mobile 21: the groceries error toast moved into the platform adapter's `showError`, and the bindings import `useTRPC` and `useUnitsQuery` from shared-react. Tests gain 17 lines, mostly a test wrapper that mounts the web's platform adapter.
