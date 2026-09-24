# Pantry

Status: ready-for-human

## Problem Statement

Every time a recipe is added to the grocery list, every ingredient line lands on it — the olive oil, the salt, the flour the household never runs out of. The shopper unticks or deletes the same staples every week. Samsung Food keeps a Pantry: what the household has at home, consulted when a recipe is added, so what is stocked is shown apart and left off the list unless asked for.

## Solution

A household **Pantry**: a list of names, edited in a panel of the groceries page opened from the same menu as the store manager, shared with the household the way Stores are. When a recipe is added to the groceries, its lines whose folded name is a Pantry Ingredient's are shown apart under **In your pantry**, unticked, and left off the list; a tick adds one anyway. Matching is exact on the folded name (ADR-0036): nothing is guessed from words.

## User Stories

1. As a household member, I want to type what is at home into a Pantry, so that a recipe's staples are not bought again every week.
2. As a household member, I want a name I add kept at once and the field ready for the next, so that a cupboard is typed in one sitting.
3. As a household member, I want to be refused a name the Pantry already has, regardless of case or punctuation, so that "Olive Oil" and "olive oil" cannot both be there.
4. As a household member, I want to take a name out of the Pantry with one press, so that running out of something costs one action.
5. As a household member, I want a housemate's Pantry edit on my screen at once, so that we keep one cupboard.
6. As a cook adding a recipe, I want the ingredients I have shown apart and unticked, so that I see what is stocked without it landing on the list.
7. As a cook adding a recipe, I want to tick a stocked line and have it added with the rest, so that being out of something is one tick away.
8. As a cook adding a recipe, I want "select all" and the count to be about what is to buy, so that the stocked lines are only ever ticked deliberately.
9. As a cook, I want a name to match only when it is a pantry name, so that "salt" in the pantry never hides "salted butter".
10. As a shopper, I want the list itself untouched by the Pantry, so that what is on the list is what I put there.
11. As a shopper on a poor connection, I want the Pantry to work offline and catch up later, so that a recipe added in the basement leaves the staples off.
12. As a mobile user, I want my list to keep working unchanged, so that a web-only step never breaks the phone.

## Implementation Decisions

**Vocabulary and the decision on record.** The words are **Pantry** and **Pantry Ingredient**, defined in CONTEXT.md under Groceries & Stores. ADR-0036 records the shape: a Pantry Ingredient is a household fact keyed by folded name, an ingredient is in the pantry only on an exact folded match, and nothing is stored on the recipe ingredient or the grocery row.

**One table, one migration.** `pantry_ingredients`: id, user id, ingredient id, timestamps and version — the same shape as `recipe_ingredients`, because a pantry name and a recipe line's name are one kind of thing. The name and its fold are read from the Ingredient Name, which gains `normalized_name` and a startup backfill for the rows written before folding. Owned by the member who typed it and read across the household's user ids, exactly as a Store is; unique per member on the Ingredient Name by row constraint, and unique per household on the *folded* name in the repository, which answers an add with what the household already holds — the check and the write one transaction under a lock on the folded name, so two adds at once cannot make two. Deleting the member cascades, as does deleting the Ingredient Name.

**The folded name is the Product Link's.** `normalizeGroceryName`, and no other rule. One shared helper answers "is this name in the pantry" for the add-to-groceries panel and the Pantry panel's duplicate check alike.

**Its own router and subscription.** `pantry.list`, `pantry.add` (client-minted id, ADR-0003; a name the household already has answers with that item's id and emits nothing), `pantry.remove` (any household member), `onAdded` and `onRemoved`. Merges are by id and idempotent, so the actor's echo and a replay are no-ops. No REST endpoint.

**Hooks and offline.** Factory hooks in shared-react beside the stores hooks; the pantry query joins the Warm Set so an offline recipe still leaves its staples off. Mutations are optimistic and go through the outbox like every grocery mutation.

**The Pantry panel.** A Panel titled Pantry opened from the groceries page's gear menu beside Manage Stores: the names by alphabet, each with a remove button; a field that adds on Enter or the plus, disabled and marked when the folded name is already there. Each add and remove writes at once.

**The add-to-groceries panel.** Lines whose name (as edited in the panel) is in the pantry are split off below a separator under an "In your pantry" heading with its own select-all, unticked; the top count and select-all concern the lines to buy, the pantry's select-all the stocked lines, and neither touches the other; the footer Add is enabled when anything at all is ticked; the create payload is unchanged and in recipe order.

**Copy, docs and release notes.** New strings in every one of the fourteen locales. A Pantry page under Groceries in the docs with two screenshots, and a feature section on the `0.24.0-beta` release-notes page.

## Testing Decisions

Browser E2E through the real stack: the pantry spec in the `ai` Playwright project seeds a recipe with two ingredient lines straight into the database, types a name into the Pantry, is refused it again, adds the recipe and sees the stocked line apart and off the list, ticks it and sees it added, removes it from the Pantry and sees it to buy again. Repository tests against Postgres pin one folded name per member, the household read, the cascade. tRPC tests with mocked repositories pin who may add and remove, the duplicate no-op, and the events. A shared-react test pins the idempotent merges. Component tests pin the Pantry panel's add and refusal, and the add-to-groceries split, tick and select-all rules.

## Out of Scope

- Mobile; amounts, units or expiry on a Pantry Ingredient; renaming an item.
- Fuzzy or whole-word matching, or any guess from words.
- An "add to pantry" action on a grocery row, or moving ticked groceries into the pantry.
- A REST endpoint; a pantry check on the manual Add Item panel; a starter list of staples.
