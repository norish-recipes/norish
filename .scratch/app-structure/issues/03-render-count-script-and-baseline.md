# 03: Render-count script and the groceries baseline

**What to build:** A committed script next to `apps/web/scripts/measure-page-loads.ts` that counts, per scripted action, mounts and re-renders per component and the prop that changed, through the React DevTools hook on a dev build (so components have names). The groceries scenario runs these actions: check an item, add an item, open the edit panel, switch the view mode, and a realtime echo from a second client changing an item. `measure-page-loads.ts` also reports the JS a page downloads, since Next 16 dropped route sizes from `next build`. Two baselines are taken: one on the current code before 01, and one after 01 and before 04, so the groundwork's rewrite of Device Preferences, which the view-mode action reads, shows apart from the pilot. See `.scratch/app-structure/spec.md`, "Measurement".

**Blocked by:** None for the script and the first baseline; 01 for the second baseline

**Status:** ready-for-agent (script and baseline 1 done; baseline 2 follows 01)

- [x] The script takes a scenario and prints, per action, mounts and updates per component, sorted by count, with the changed props behind each update.
- [x] The groceries scenario covers the five actions, the echo coming from a second signed-in browser context.
- [x] Two runs on unchanged code give the same counts.
- [x] `scripts/README.md` says how to run it in a few lines.
- [x] `measure-page-loads.ts` reports the JS bytes each page downloads, added up from its script responses.
- [ ] Both baselines are recorded under `## Comments` here: per-action renders, `/groceries` first paint and downloaded JS from `measure-page-loads.ts`, and the code shape (folders groceries spans, lines in web, mobile and shared-react, binding files).

## Comments

### Measurement setup

Every baseline, and 07's after numbers, reuse this.

- **Data set**: the one `measure-renders.ts` writes through the API at the start of every run (`resetGroceries`). Four Stores: Albert Heijn (aisles Produce, Dairy, Bakery), Lidl (Produce, Frozen), Butcher, Farmers market. 45 rows: 24 groceries under the Stores and 4 under none, 4 recurring (milk and eggs weekly, coffee beans and bin bags monthly), and all 13 lines of three recipes (Spaghetti bolognese, Green curry, Pancakes) with no Store. 4 rows are done, 6 have a by-hand price, 12 are filed under an aisle. Stores, prices, aisles and recipes are made once and kept; groceries are replaced every run. Each Store's groceries get a sortOrder range of their own (0–99, 100–199, …, no Store last): the server orders the list by sortOrder alone, so equal values across Stores came back in a different order per run and changed the counts.
- **Server**: a fresh `norish_measure` database in `norish-db-local`, migrated and seeded by its first boot, AI off, owner `mike@mike.nl` / `mikemike` signed up first. From `apps/web`, with the root `.env.local` plus `DATABASE_URL=…/norish_measure VALKEY_URL=redis://localhost:6379/4 PARSER_API_PORT=8401 AUTH_RATE_LIMIT_ENABLED=false` and `PORT`, `AUTH_URL` and `TRUSTED_ORIGINS` on the port: the dev server on :3401 (`node --import tsx server/index.ts`) for renders; `next build`, then the same with `NODE_ENV=production UPLOADS_DIR=$PWD/.runtime/uploads` on :3400 for page loads.
- **Renders**: `pnpm --filter @norish/web run measure:renders groceries --base http://localhost:3401 --email mike@mike.nl --password mikemike`. A Pixel 7, store view, grouped. Actions in this order: check "cucumber" (Albert Heijn), add "paprika" (the press of Add in the open panel), open "tomatoes" for editing, a second signed-in phone checks "carrots" (Lidl), switch to By Recipe.
- **Page loads**: `pnpm --filter @norish/web run measure:page-loads --base http://localhost:3400 --email mike@mike.nl --password mikemike --only /groceries`, straight after a renders run (the data set plus "paprika", with "cucumber" and "carrots" checked). 15 runs, service worker blocked.
- **Code shape**: groceries with stores and the Pantry, `.ts`/`.tsx` under git, tests apart. Web: `app/(app)/groceries/`, `components/groceries/`, `hooks/{groceries,stores,pantry}/`, `components/Panel/consumers/{add-grocery-panel,edit-grocery-panel,mini-groceries,recurrence-panel}.tsx`, `components/skeleton/grocery-skeleton.tsx`, `context/pantry-realtime-context.tsx`, `hooks/use-recurrence-detection.ts`. Mobile: `src/hooks/groceries/`. shared-react: `src/{contexts,hooks}/{groceries,stores,pantry}/`, `use-grocery-form-state.ts`, `use-recurrence-detection.ts`. A binding file calls a groceries, stores or Pantry `create*Hooks`/`create*Context` factory (or `createUseRecurrenceDetection`) or re-exports what one built.

### Baseline 1 (before 01, at 24c49fff0)

App code as at d0fa9f86a; 24c49fff0 adds only the scripts. Five runs, two of them at 24c49fff0 after a dev-server restart, printed byte-identical output.

**Renders per action**

| Action                                          | Baseline 1: mounts / updates / commits | Baseline 2 | After the pilot |
| ----------------------------------------------- | -------------------------------------: | ---------: | --------------: |
| Check an item                                   |                            0 / 290 / 6 |          — |               — |
| Add an item                                     |                        19 / 2,114 / 13 |          — |               — |
| Open the edit panel                             |                          178 / 224 / 8 |          — |               — |
| Realtime echo of another phone checking an item |                            0 / 247 / 2 |          — |               — |
| Switch the view mode                            |                         853 / 696 / 11 |          — |               — |

| Action               | Baseline 1: top three (mounts + updates, what changed)                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Check an item        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; motion.div 13                           |
| Add an item          | React Aria DOMElement 185; SortableGroupItem 164 (children 122, (context) 81, group 75); bound DOMElement 154 |
| Open the edit panel  | Presence 26; React Aria DOMElement 25; Primitive.div 21                                                       |
| Realtime echo        | SortableGroupItem 80 ((context) 80, children 40); SortableContext 20; motion.div 10                           |
| Switch the view mode | React Aria DOMElement 206; bound DOMElement 160; React Aria provider 113                                      |

Our own components behind those numbers:

- Check and echo: all 40 group rows (`SortableGroupItem`) render twice on a context change, and every Store section once, for one checked row.
- Add: three commits re-render the whole list: the optimistic row (801 components), the create's socket events (503) and its answer (487). `GroupedGroceryItem` renders 115 times, 75 of them for a new `group` object: `GroceryList`'s `useStructuralSharing([...builtGroups])` matches the groups map's entries by position, and the new row puts the no-Store entry first, so every Store's groups come back as new objects. The page also fetches `config.units`, `ingredients.icons` and `stores.aisleLinks` (twice in one batch) again.
- Switch the view mode: By Recipe mounts 40 `GroceryItem`s, and each renders once more on a context change.

**`/groceries` page load** (15 runs, median and spread)

|                       |            Baseline 1 | Baseline 2 | After the pilot |
| --------------------- | --------------------: | ---------: | --------------: |
| First paint           |      632 ms (624–640) |          — |               — |
| Price and aisle drawn |      632 ms (624–640) |          — |               — |
| Document              |          42.5 KB gzip |          — |               — |
| JS downloaded         | 894 KB gzip (894–894) |          — |               — |

**Code shape**

|                           |                              Baseline 1 | Baseline 2 | After the pilot |
| ------------------------- | --------------------------------------: | ---------: | --------------: |
| Web                       |                  99 files, 10,317 lines |          — |               — |
| Mobile                    |                       2 files, 47 lines |          — |               — |
| shared-react              |                   27 files, 2,911 lines |          — |               — |
| Folders (with subfolders) |    web 9 (14), mobile 1, shared-react 6 |          — |               — |
| Binding files             | web 20 (303 lines), mobile 2 (47 lines) |          — |               — |
| Unit tests                |                   25 files, 6,974 lines |          — |               — |

Web's folders: `app/(app)/groceries` (+`components`, `pantry`), `components/groceries` (+`dnd`, `pantry`, `stores`), `hooks/groceries`, `hooks/stores`, `hooks/pantry`, `components/Panel/consumers`, `components/skeleton`, `context`, `hooks`. shared-react's: `contexts/groceries`, `contexts/stores`, `hooks/groceries`, `hooks/stores`, `hooks/pantry`, `hooks`.

Also seen: every dev load of `/groceries` logs a hydration attribute mismatch, dnd-kit's `aria-describedby="DndDescribedBy-N"` counter differing between server and client. React leaves it unpatched, so it adds no renders.

### Baseline 2 (after 01, before 04)

Follows 01.
