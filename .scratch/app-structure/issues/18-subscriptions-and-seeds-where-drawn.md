# 18: Subscriptions and seeds where they're drawn

**What to build:** Whatever draws data mounts the subscriptions that keep it current: a feature's root for its screens, a panel for itself while it is open, and the shell for what it draws itself plus the Reader. Cookbooks, the Pantry, the ingredient catalogue and the archive import leave the shell for the screens and panels that draw them, and each layout seeds only what its screens draw, the `(app)` layout included. The shell keeps the Reader's subscriptions, admin config and the import outcomes from 16. Nothing visible changes, but for one fix: `MiniGroceries`' "on the list" mark becomes live wherever the panel opens. See `.scratch/app-structure/spec.md`, the subscription and seeding rules under "shared-react" and "Library (the third feature)".

**Blocked by:** 17

**Status:** done

- [x] Cookbooks: `CookbooksRealtimeProvider` leaves the shell. Library's root and the recipe page mount the cookbooks subscription, and so does `MiniCookbooks` while it is open.
- [x] The Pantry leaves `ShellSubscriptions`. Groceries' root and library's root mount it, the latter for the pantry-share order, and so do `MiniGroceries` and `IngredientPanel` while they are open.
- [x] The ingredient catalogue leaves `ShellSubscriptions`. The recipe page (cooking mode included), the editor, groceries' root and the ingredient settings page mount it, and so do `MiniGroceries` and `IngredientPanel` while they are open.
- [x] Panels mount their subscriptions and content only while open: `MiniGroceries` groceries, the Pantry and the ingredient catalogue; `MiniCookbooks` cookbooks; `MiniRecipes` the recipe list events; `IngredientPanel` the ingredient catalogue, the Pantry and groceries. `MiniCalendar` already does this. The recipe page's two closed `MiniGroceries` stop reading the Pantry and groceries.
- [x] The archive import's provider leaves the shell for the user settings page, which draws its progress.
- [x] `ShellSubscriptions` mounts only the Reader's household and permissions, admin config, and the import outcomes.
- [x] The `(app)` layout seeds only permissions and Device Preferences. Favourites, the household and the reader's allergies are seeded by the `(library)` and recipe layouts through one helper, and the pending imports by `(dashboard)`. The avatar menu's language switch reads the saved locale only when the menu opens, so the navbar stops reading `user.get` and the allergies on every page.
- [x] `library.list` gets a `gcTime` default in the Offline Cache, so the grid outlives a long cooking session.
- [x] CONTRIBUTING's "App architecture" and the Architecture page state the subscription rule and the seeding rule, each with its line of why. They drop "in the shell when screens outside the feature show the data, such as the Pantry".
- [x] 16's three realtime tests still pass, each with `--repeat-each`.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
