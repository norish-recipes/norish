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

| Action                                          | Baseline 1: mounts / updates / commits |      Baseline 2 | After the pilot | After 07's fixes |
| ----------------------------------------------- | -------------------------------------: | --------------: | --------------: | ---------------: |
| Check an item                                   |                            0 / 288 / 7 |     0 / 288 / 7 |     0 / 269 / 7 |      0 / 106 / 7 |
| Add an item                                     |                        19 / 1,689 / 12 | 19 / 1,689 / 12 | 19 / 1,532 / 13 |    19 / 292 / 11 |
| Open the edit panel                             |                          178 / 224 / 8 |   178 / 224 / 8 |   178 / 221 / 8 |    178 / 107 / 5 |
| Realtime echo of another phone checking an item |                            0 / 247 / 2 |     0 / 247 / 2 |     0 / 228 / 2 |       0 / 60 / 2 |
| Switch the view mode                            |                         853 / 696 / 11 |  853 / 701 / 10 |  857 / 700 / 10 |   853 / 700 / 10 |

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

|                       |            Baseline 1 |            Baseline 2 |       After the pilot |      After 07's fixes |
| --------------------- | --------------------: | --------------------: | --------------------: | --------------------: |
| First paint           |      632 ms (624–672) |      632 ms (628–636) |      628 ms (624–640) |      628 ms (624–648) |
| Price and aisle drawn |      632 ms (624–672) |      632 ms (628–636) |      628 ms (624–640) |      628 ms (624–648) |
| Document              |          42.5 KB gzip |          42.6 KB gzip |          42.6 KB gzip |          42.6 KB gzip |
| JS downloaded         | 894 KB gzip (894–894) | 900 KB gzip (900–900) | 859 KB gzip (859–859) | 860 KB gzip (860–860) |

**Code shape**

|                           |                              Baseline 1 |                              Baseline 2 |                     After the pilot |                    After 07's fixes |
| ------------------------- | --------------------------------------: | --------------------------------------: | ----------------------------------: | ----------------------------------: |
| Web                       |                  99 files, 10,317 lines |                  99 files, 10,308 lines |               77 files, 9,894 lines |               77 files, 9,980 lines |
| Mobile                    |                       2 files, 47 lines |                       2 files, 26 lines |                    0 files, 0 lines |                    0 files, 0 lines |
| shared-react              |                   27 files, 2,911 lines |                   27 files, 2,911 lines |               18 files, 2,290 lines |               18 files, 2,274 lines |
| Folders (with subfolders) |    web 9 (14), mobile 1, shared-react 6 |    web 9 (14), mobile 1, shared-react 6 | web 2 (9), mobile 0, shared-react 1 | web 2 (9), mobile 0, shared-react 1 |
| Binding files             | web 20 (303 lines), mobile 2 (47 lines) | web 20 (299 lines), mobile 2 (26 lines) |                                none |                                none |
| Unit tests                |                   25 files, 6,974 lines |                   25 files, 6,991 lines |               31 files, 7,538 lines |               31 files, 7,571 lines |

Web's folders: `app/(app)/groceries` (+`components`, `pantry`), `components/groceries` (+`dnd`, `pantry`, `stores`), `hooks/groceries`, `hooks/stores`, `hooks/pantry`, `components/Panel/consumers`, `components/skeleton`, `context`, `hooks`. shared-react's: `contexts/groceries`, `contexts/stores`, `hooks/groceries`, `hooks/stores`, `hooks/pantry`, `hooks`.

Also seen: every dev load of `/groceries` logs a hydration attribute mismatch, dnd-kit's `aria-describedby="DndDescribedBy-N"` counter differing between server and client. React leaves it unpatched, so it adds no renders.

### Baseline 2 (after 01, before 04)

At 2696c4a86 plus the setter fix 935985ceb, re-taken at ade41b0a2 with the setup above. The first record, at 2696c4a86 alone, caught 01 handing out a new Device Preference setter on every render: `useDevicePreference` built `trpc.user.getDevicePreferences.queryKey()`, a new array, each render and the React Compiler keyed the setter on it. That cost 8 updates opening the edit panel and 27 switching the view mode. It is 01's defect, so it is fixed here rather than credited to the pilot. Two renders runs printed byte-identical output, [`baselines/2-after-01.txt`](../baselines/2-after-01.txt), and a third after 0b588ae0d's `closePanel` change matched them. The page loads are the second of two 15-run sets on a fresh production build, at a load average near 3.

| Action               | Baseline 2: top three (mounts + updates, what changed)                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Check an item        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; React Aria DOMElement 13                |
| Add an item          | SortableGroupItem 164 (children 122, (context) 81, group 52); React Aria DOMElement 137; bound DOMElement 108 |
| Open the edit panel  | Presence 26; React Aria DOMElement 25; Primitive.div 21                                                       |
| Realtime echo        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; motion.div 10                           |
| Switch the view mode | React Aria DOMElement 221; bound DOMElement 160; React Aria provider 123                                      |

What changed against Baseline 1, component by component:

- Check, add and echo render the same components the same number of times; only reasons moved. `useUnitFormatter` (every row with an amount) and `IngredientIconsProvider` now each hold a `user.getDevicePreferences` query, whose snapshot moves without a render while the choice stays the same. The "By Store" pick before the actions writes the choice and reads it again (`dataUpdatedAt`), so the next render records `(state)`: `IngredientIconsProvider`'s one update in check, and the first of the three passes of the 17 no-Store `GroupedGroceryItem`s in add. Their other two passes see the `config.units` re-fetch start and answer, where Baseline 1 marked one pass: `(state)` 17 becomes 51 of the same 69 updates.
- Open the edit panel renders the same components the same number of times, for the same reasons.
- Switch the view mode, 5 more updates (57 gone, 62 added) and one commit fewer.
  - Gone: the 40 `GroceryItem` updates after mounting, and 17 elsewhere. `useUnitFormatter`, `IngredientIconsProvider` and `AddGroceryButton` (whose docked-timers check reads the hidden items) read the old provider's context, which changed again when the write settled; each now selects its one choice, which did not change. The old provider (3 updates) also wrote the change onto `user.get` and read `user.get` again, which rendered the profile's readers: `OfflineStatusModal` 4, `NavbarUserMenu` 2, `TimerDock` 2, and `UserProvider`, `WebUserProviderInner`, `PermissionsProvider` and `OfflineCacheController` 1 each. The write and the read again now go to `user.getDevicePreferences`, which only `useDevicePreference` readers hold. The commit gone is the old provider's third render, for that read's answer (it read `dataUpdatedAt`); an equal answer now renders nothing.
  - Added: the open View Mode menu renders once more, all of it (`Component` 12, React Aria DOMElement 15, React Aria provider 10, `CollectionBranch` 3, one or two each of its other parts). The old provider set React state in the click, so the new view and the menu's close rendered in one commit. `useDevicePreference` writes the query cache in the click too (`onMutate` runs inside `mutate`), but TanStack Query tells a query's readers in a `setTimeout(0)` task, after React has committed the click. A per-commit log, taken twice, shows the menu's close in the click's commit, then `GroceriesUiProvider`, the page and the exiting menu in a task TanStack's timer started, so writing the cache before `mutate` changes nothing.

Page loads: first paint the same at the median, inside Baseline 1's spread. Document +0.1 KB: the seed is now the `user.getDevicePreferences` query with both Device Kinds' blocks, where it was this kind's values. JS +6 KB gzip, not traced: 01's new modules on the page weigh about 5.7 KB gzip (Device Preferences reader 1.6, plain config hooks 3.1, tRPC provider 0.8, platform adapter 0.3), but most replace code the page had before, so the cause needs a Baseline 1 build to diff against (`measure-page-loads --scripts` lists the chunks).

Code shape: 01 moved or deleted none of the counted files (its moves are config, tRPC, the platform adapter and Device Preferences), so every path is Baseline 1's. Binding files, by the rule above: web's six factory callers (`shared-{groceries,stores,pantry}-hooks.ts`, `use-recurrence-detection.ts`, the groceries and stores contexts) and the 14 per-hook files that import a `shared-*-hooks` file; mobile's `shared-groceries-hooks.tsx` and the `index.ts` barrel that imports it. Web loses 9 lines and mobile 21: the groceries error toast moved into the platform adapter's `showError`, and the bindings import `useTRPC` and `useUnitsQuery` from shared-react. Tests gain 17 lines, mostly a test wrapper that mounts the web's platform adapter.

### After the pilot

Taken by 07 at e4724ee83, as measured, and again after 07's fixes at 37504a285 (5c74a46a9 only reformats). The fixes after 07's review (1a2b161f2 to 33f085b09) weren't re-measured. Each record printed byte-identical output twice. [`baselines/3-after-pilot.txt`](../baselines/3-after-pilot.txt) holds the final one; 3b6cf0947 holds the as-measured one. The page loads are the second of two 15-run sets on a fresh production build each, started at a load average of 3.2 and 2.7.

The setup's paths, moved to where groceries lives now. Web: `features/groceries/` and the route files in `app/(app)/groceries/`. It leaves out what other features render, `components/round-checkbox.tsx` (112 lines) and `components/ingredients/on-the-list-mark.tsx` (17), and `app/(app)/shell-subscriptions.tsx`, which mounts the Pantry's subscription with the shell's others. Mobile has no groceries files: the smoke screen imports `@norish/shared-react/groceries` itself. shared-react: `src/groceries/`. Tests: the `*.test.*` files and `test-utils.tsx` in those folders, 19 in web and 12 in shared-react. No binding file is left: nothing calls a groceries, stores or Pantry factory, or `createUseRecurrenceDetection`.

| Action               | After the pilot: top three (mounts + updates, what changed)                                                   | After 07's fixes: top three                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Check an item        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; React Aria DOMElement 13                | SortableContext 14 ((context) 10, children 4); React Aria DOMElement 8; bound DOMElement 6                |
| Add an item          | SortableGroupItem 164 (children 122, (context) 81, group 52); React Aria DOMElement 133; bound DOMElement 108 | SortableGroupItem 54 ((context) 35, group 35); IngredientIcon 43 ((context) 41); React Aria DOMElement 15 |
| Open the edit panel  | Presence 26; React Aria DOMElement 25; Primitive.div 21                                                       | React Aria DOMElement 21; Presence 14; Portal 11                                                          |
| Realtime echo        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; motion.div 10                           | SortableContext 13 ((context) 10, children 3); motion.div 6; MeasureLayout 5                              |
| Switch the view mode | React Aria DOMElement 221; bound DOMElement 160; React Aria provider 123                                      | React Aria DOMElement 221; bound DOMElement 160; React Aria provider 123                                  |

What the pilot changed against Baseline 2, as measured:

- Check and echo, 19 fewer. `GroceriesProvider` and `StoresContextProvider` are gone, and the closed panels (Add, Store manager, Delete Store) and the header menu no longer render for a list change, since each panel reads only whether it is open. Added: one render of 06's `DndContext` wrapper, and `GroceriesPage` once when the toggle settles, which `GroceriesProvider` did before.
- Add, 157 fewer: the same, plus the 17 no-Store rows' `(state)` pass, gone since reference data stopped refetching on mount (a652068c2, 8f244aa7a), and the Add panel's four renders down to two. Three more `DndContext` renders.
- Edit panel, 3 fewer: opening it renders `EditGrocery`, which reads the id from the store, where it rendered the page, the header menu and the add button.
- View mode: `GroceriesUiProvider` and the add button are gone; the wrapper adds four `DndContext` mounts.
- First paint 4 ms faster at the median, inside both baselines' spread. JS 41 KB gzip less, not traced: the pilot's commits are the only change since Baseline 2 besides zustand joining; tracing needs a Baseline 2 build to diff `--scripts` against.

What 07 fixed:

- `DndContext` (579f2020b): the wrapper rendered with every new prop. Each of the seven uses passes `id={dndId}` again, and lint asks for the id and says why, so the reason is written once.
- dnd-kit's measuring (d4430808e): both lists asked for `MeasuringStrategy.Always`, which measures every drop target whenever one registers or leaves and hands every sortable a new rects map. Measured only while a drag is on (the default), a row leaving renders the `SortableContext`s but not their rows.
- Store sections (f2ff3c9f3): each section got the whole list's groups, its own handler closures and a DnD context that changed with any container, so all five rendered for one row. Now a section reads its containers off its own groups, the context changes only while a drag is on, and the Store actions take the Store's id. `SortableGroupItem` is memoised with one row function per section. A drop shows its arrangement until the list comes back from the cache, as before.
- The create's answer (cee6cb551): it merged the rows the server moved down and then moved them down again, which left the cache one place off the server until the `updated` event; the recurring create already applied the server's rows last. A test covers it, and the event now changes nothing.
- Grouped rows (ee967e523): a create moves every open line below it and the server bumps their versions. A row now skips a group that differs only there; its actions read versions from the cache.
- The closed clear modal (837425e3f): `GroceriesPage` gave it a new empty id list on every list change; the header menu now reads whether there is anything to clear as a boolean.
- Recurrence hints (4a620743f): parsed in a transition, which rendered the panel twice per name for an `isParsing` nobody read.
- The panels' lookups (37504a285): the edit panel opened empty and then seeded its name, so the food lookup's 400 ms debounce caught up a render later; the form now starts on the grocery. The link and food lookups share one settled name, and an emptied field settles at once, so the Add panel no longer renders 400 ms after Add. Typing still waits 400 ms, now from the first name typed too.

Two drags by hand on the measuring server, a reorder within an aisle and a move into another Store, landed and survived a reload; the E2E set runs after the ticket set.

What remains after 07, per action, in updates; each line says what is on screen or why it renders without a change:

- Check an item (106):
  - 40: the pressed checkbox's hover, press, tick and release. React Aria keeps them as state, and HeroUI's checkbox hands them to its parts through context.
  - 5: the page, the list, the icons provider, the list's content and the DnD provider, which carry the new list down.
  - 8: Albert Heijn's section, card, heading (one open less), done row (one done more) and the Produce aisle (one row less).
  - 2: bananas and tomatoes, the rows left in Produce: dnd-kit's `SortableContext` hands its items to every sortable in it.
  - 7: Dairy, Bakery and the Store's unfiled area: the section hands each aisle new heading and row elements, so its container, heading and `SortableContext` render. Their rows don't. Not on screen; memoising an aisle block needs its rows structurally shared too.
  - 15: the five Store boxes. Motion measures a `layout` box only when it renders, and the three below Albert Heijn move up.
  - 8: dnd-kit's `DndContext` with its six own children, which it doesn't memoise; its drag handlers close over the list's containers, which changed.
  - 20: dnd-kit's commit for the checked row's drop target leaving. Its registry is `DndContext` state (8 with its children), every `SortableContext` reads it (10), and the Produce rows render once more as `SortableContext` turns transforms back on the render after its items changed (2).
  - 1: `GroceriesPage` when the toggle settles: TanStack's `useMutation` renders the component that holds it on each status change.
- Add an item (292, and paprika's row mounting):
  - 10: the Add button's hover and press states, and the name field losing focus to it.
  - 58: the panel clearing its name, product and recurrence fields; it stays open on the same Store.
  - 65: the optimistic row. The data path (5); the unsorted section, card, open count, box and `SortableContext` (5); the 17 rows below moved one place, whose `SortableGroupItem`s render while the rows skip it (17); flour, the former first row, whole for its corners (15); the Store boxes (15) and `DndContext` (8) as above.
  - 47: dnd-kit's commit for paprika's drop target: `DndContext` (8), every `SortableContext` (10), the transform flip for the unsorted area's 18 rows (18), and paprika's checkbox (11), whose React Aria description and error-message slots settle to absent after mount.
  - 4: the header menu and the closed clear-list modal, which hold the list's ids and count.
  - 66: the create's answer. The 17 rows' new versions reach their `SortableGroupItem`s (17), paprika's row renders whole as its food and icon arrive (17 with its own `SortableGroupItem`), plus the data path, the unsorted section (3), the Store boxes and `DndContext`.
  - 0: the server's `updated` event, which now matches the cache.
  - 42: the icons read again for the new set of foods. The icons context hands every `IngredientIcon` the whole answer, so all 41 render for paprika's one. Per-icon selection needs a store outside context; left for the recipes migration, which shares the component.
- Open the edit panel (107, and 178 mounts):
  - 1: `EditGrocery` reads the id from the store and mounts the panel.
  - 12: the panel's content mounting, with the link and food answers from the cache.
  - 92: the drawer opening: vaul and Radix set their open and presence state after mount, and the panel's portal container is known once the drawer body has mounted, which renders the selects' popovers.
  - 2: Radix's dismissable layer registering.
- Realtime echo (60): commit one is check's commit five for Lidl (41: carrots leaves Produce, apples gets the new items, Frozen and the unfiled area render as above); commit two is dnd-kit's registry commit (19).
- Switch the view mode (700, and 853 mounts):
  - 106: the menu item's press and the menu closing.
  - 79: By Recipe mounting, the tick moving in the menu and the Store-only section hiding.
  - 510: after mount. About 440 are the 40 new checkboxes rendering once more with their parts: React Aria's `useToggle` asks for a description and an error-message slot (`useSlotId2`, both starting true), and a layout effect sets both false when neither is rendered. The rest: the four recipe sections' `DndContext`s filling their registries and mounting their live regions (28), and the closing menu's collection.
  - 5: the popover's exit, the button's release, and the Device Preference write settling: `GroceriesPage` and the header menu hold `useDevicePreference`, whose `useMutation` renders them.
