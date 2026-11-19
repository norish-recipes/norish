# Mobile Search

Status: tickets 01-08 open

Settled in a `/grill-with-docs` session on 2026-11-19. The design is the Search page of the "Norish iOS" canvas (https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-b651411d24f3, Version 114): SearchPage, SrFocused, SrTyping, SrBrowse, SrResults, SrNone, each light and dark. Vocabulary is CONTEXT.md's: **Search Scope**, **Recent Search**, **Category**, **Tag**, **Ingredient**, **Parent Ingredient**, **Ingredient Icon**, **Hidden Item**, **Offline**, **Offline Cache**. Part of the mobile redesign (`.scratch/mobile-redesign/spec.md`), branch `feat/mobile-redesign`, Target Version 0.27.0-beta.

## Problem Statement

The mobile Search tab is a placeholder. The Recipes tab has no search field because Search was meant to own it, so on the phone a reader can filter the Library but cannot look a recipe up by name, ingredient or tag.

## Solution

The Search tab becomes the designed page. With the keyboard down it offers Recent Searches, Categories, Quick filters and Tags. Typing suggests two recipes, plus Ingredients, Tags and Categories to narrow to. Confirming shows results, with filter chips, a sort chip and a match line that says why each recipe matched. The Search Scope chips pick where the text is looked for. The server gains an ingredient filter that includes kinds of a food, one suggestion query, a per-result match, and the reads the discover sections need.

## User Stories

1. As a household member, I want to tap Search in the tab bar and type straight away, so that finding a recipe takes one step.
2. As a household member, I want suggestions as I type, so that I can open a recipe before finishing the word.
3. As a household member, I want to narrow to an ingredient, tag or category while typing, so that "chick" can become "recipes with chicken" in one tap.
4. As a household member, I want narrowing to chicken to find chicken thighs too, so that kinds of a food count.
5. As a household member, I want to choose where my words are looked for (title, ingredients, tags, description, steps), so that a common word doesn't flood the results.
6. As a household member, I want each result to say why it matched, so that an unexpected recipe makes sense.
7. As a household member, I want to sort results by best match, newest, oldest or name, and have that sort really apply, so that I find what I'm after.
8. As a household member, I want to filter search results without changing my Library's filters, so that the two don't interfere.
9. As a household member, I want my recent searches on this phone, gone when I sign out, so that repeating one is a tap and nobody else sees them.
10. As a household member, I want to browse by Category, Quick filter or Tag without typing, so that Search also helps when I don't know what I want.
11. As a household member, I want a no-results state that tells me what to loosen, so that I'm not stuck.
12. As a household member, I want to open a result and come back to my results where I left them, so that I can compare recipes.
13. As a household member who hid ratings or favourites, I want their Quick filters gone too, so that hidden stays hidden.
14. As a household member who is Offline, I want Search to say it needs a connection, rather than show nothing, so that I know why.

## Implementation Decisions

### Server (mobile is the only new client; web is unchanged)

- **Sort.** An explicit sort (Newest, Oldest, A–Z, Z–A) orders the results even while searching; **Best match** is the existing `sortMode: "none"` (rank when there is text, newest otherwise). The rule is opt-in through a request flag only mobile Search sends, so web keeps its look and ordering.
- **Ingredient filter** on `library.list`: recipes with a line naming the Ingredient or any descendant through Parent Ingredient, never an ancestor. The All/Any mode covers Tags and Ingredients; Categories stay Any, as today.
- **Suggestions**: one query for the typed text returns up to 3 Ingredients (name or any Ingredient Alias, only foods named by recipes the reader can see, most-used first), 3 Tags and 3 Categories whose names match. Recipe suggestions are `library.list` itself, capped.
- **Match**: each result of a search carries its strongest match within the Search Scope, ordered title > tag > ingredient > description > step, plus the matched text: the tag, the ingredient line as written, or a short snippet around the hit. With no text but an Ingredient filter, the line that satisfied it.
- **Discover reads**: up to 4 Categories that hold a recipe the reader can see, built-ins first, each with the newest such recipe's primary image; the 12 most-used Tags over the recipes the reader can see.

### Mobile

- **Route.** The `role="search"` tab becomes a stack. A result opens the recipe inside it, so back returns to the results with the scroll kept, and cook mode, plan and add-to-groceries work from there as from the Recipes tab.
- **State.** Search has its own filter store, separate from the Recipes tab's, never persisted. Query, chips, Search Scope and sort last for the session. The funnel opens the existing Filters sheet bound to Search's store.
- **Field.** The tab bar's search pill is the field (iOS draws the morph). **×** dismisses the keyboard and keeps everything; **⊗** clears the text; the Recipes button leaves Search. A pasted URL is searched like any text.
- **Search Scope row.** Glass toggle chips above the field: Title, Ingredients, Tags, Description, Steps. Several may be on, at least one always is, Title and Ingredients by default. Shown only while the field has text; a change re-runs the search.
- **Typing.** A "Search for '…'" row, 2 recipe suggestions (title hit highlighted), and "Narrow to" rows for Ingredients (with their Ingredient Icon, unless Hidden Items hides icons), Tags and Categories. The keyboard's search key or the "Search for" row confirms and shows Results. A recipe suggestion opens the recipe. A Narrow-to row adds a chip, clears the text and shows Results.
- **Results.** Filter chips (× removes), a sort chip (Best match while there is text, otherwise Newest; then Newest, Oldest, A–Z, Z–A), the funnel with a count badge, a recipe count, and the Recipes tab's library card with the match line in place of its description while searching. Recipes only, never cookbooks.
- **No results.** With filters: "Try adjusting or clearing your filters" and **Clear filters**, which keeps the text. Without filters but a narrowed Search Scope: **Search all fields**. Otherwise "No recipes match '…'", with no button.
- **Discover** (no text). Recent Searches, Categories (photo tiles), and, with the keyboard down, Quick filters (Favorites, Under 30 min, 4 and up, Ingredients at home) and Tags. Favorites and 4 and up hide when Hidden Items hides favourites or ratings. Tapping a Category, Quick filter or Tag toggles its chip and shows Results.
- **Recent Searches.** Confirmed text only, never chips or scope. The newest 10, no duplicates, on the device per account, wiped at sign-out. Tapping one re-runs it; ↖ puts it in the field to edit; **Clear** empties the list.
- **Offline.** Discover sections show from the Offline Cache. Typing shows no suggestions. A confirmed search shows a card saying search needs a connection.

## Testing Decisions

- Each server change gets repository tests against the test database: sort with and without text, ingredient filter (descendants in, ancestors out, All/Any with tags), suggestions (aliases, visibility, most-used order), match (each field, scope respected, ingredient-only), discover reads (cap, built-ins first, empty categories skipped).
- Mobile logic that decides a state (which state shows, chip/scope rules, recent-search list rules, no-results variant) lives in plain modules with unit tests; screens get component tests where the repo already has them.
- Maestro flows for confirm → results → open recipe → back, Narrow to an ingredient, and a Recent Search, run once after the whole ticket set; a device check in light and dark.

## Out of Scope

- Web search UI: web gains no ingredient filter, suggestions, match line or discover sections here. Web parity is its own spec.
- Searching the Offline Cache locally.
- Cookbooks in Search results.
- Importing a pasted URL from the search field.
- iPad and foldable layouts.
