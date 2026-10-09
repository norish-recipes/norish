# Piece weights and other findings outside spoons

Notes from the 2026-10-02 spoon-measures session, written as input for a later `/grill-with-docs`. Nothing here is decided. Everything was found by running the real modules against the dev database, and all of it is live on rc/0.25.0-beta.

## Piece weights borrowed across sizes

A counted line with no piece weight of its own borrows its nearest parent's, and size varieties sit under the full-size food:
- "10 cherry tomatoes" counts as 1,500 g, ten of tomato's 150 g. A cherry tomato weighs about 17 g.
- "4 spring onions (65g)" counts as 400 g, four of onion's piece weight, although the line itself says 65 g.

Numbers per 100 g lend well along these edges, since a cherry tomato is a tomato. Weight per piece does not. The total says it is estimated, but it is ten times off.

Open:
- Should piece weights be borrowed at all? Or only from a parent a person chose, or never across a size word (cherry, baby, mini, spring)?
- Should size varieties get piece weights of their own, through a piece-weight fix like ticket 15's density fixes? USDA weighs a cherry tomato.
- A weight in brackets ("(65g)", "(100g)") is the recipe's own answer. Should the parser keep it?

## Size words stored as units

"1 small red onion (100g)" and "2 large tomatoes" store "small" and "large" as their unit, so both are left out although onion and tomato have a piece weight.

Open: should small, medium and large count as pieces, and if so, should they be scaled?

## "kilo"

"1 kilo kruimige aardappelen" stores amount 1, no unit and the name "kilo kruimige aardappelen". It counts as one 150 g potato instead of 1,000 g. The units map has no kilogram entry, so "kilo" never reaches the unit table, even though the table lists that spelling. The fix is probably one units-map entry, next to ticket 14's work.

## English "paprika"

"paprika" is a Croatian alias of `en:bell-pepper`, and `en:paprika` (the spice) has no English alias. An English "1 tsp paprika" therefore lands on bell pepper: no density, and the wrong aisle. Dutch "paprika" is the vegetable too, and German "Paprika" is both. Under ADR-0037 one folded spelling is one alias instance-wide, so a word that means two foods in two languages can only mean one of them. Dutch "paprikapoeder" resolves correctly.

Open: which food owns "paprika", and how does an English recipe reach the spice?
