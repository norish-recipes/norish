# 13 — A cookbook describes itself by its members

**What to build:** A cookbook card said only its title and a count. It now states what a recipe card states, answered by the set: the member names as its description, every member's cooking time added up, the smallest number of people any member serves, and the reader's own allergens found among the member tags. All of it derived at read time, exactly as the cover is — `spec.md`'s "no stored field beyond the title" holds.

**Status:** ready-for-human

- [x] `CookbookSummarySchema` gains `memberTitles`, `memberTags`, `totalMinutes` and `minServings`, all viewer-scoped
- [x] They are computed in `memberSummaries` beside the cover, under the same view-policy condition, so what a card says agrees with what the page lists (ADR-0027)
- [x] A member stating none of the three time columns contributes nothing rather than zero, so a cookbook of untimed recipes says nothing instead of "0m"
- [x] Whether a tag is an allergen is the reader's answer — household list first, then their own — so the server sends member tags and the card does the intersection
- [x] Member tags are deliberately uncapped: any cap drops whichever tags it orders last, and a card that silently omits an allergen is worse than a larger row
- [x] Only the reader's allergens reach the card; the rest of the member tags are not chips
- [x] The list row keeps a recipe list row's chip budget, so it wraps no more often than the row above it
- [x] Database seam test: the description, the summed time, the smallest serving and the member tags, the untimed case, and that all of it is scoped to the members the reader may see
- [x] Unit test over the card's own rendering of them
