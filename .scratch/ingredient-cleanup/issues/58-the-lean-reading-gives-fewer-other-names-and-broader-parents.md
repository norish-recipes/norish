# 58: The lean reading prompt gives fewer other names and broader parents

**What to build:** Found by ticket 31's run after ticket 56 (2026-10-22, HEAD 44297d433, `m56_post_on`). With ticket 56's rewritten `ingredient-resolution` prompt, the same 573 names read in both runs came back with the same kind and sureness as last run, but with far fewer other names and looser parents:

- Other names: missing on 425 of 599 foods read (71%), against 173 of 596 (29%) last run. The pass finds the right existing food through the other names; without them, 39 own foods that last run merged, rightly, into an existing food (a Dutch word for caster sugar, whipping cream, allspice berries, dried thyme, garden peas, mixed salad, green pesto, and more) now stay own foods under their general food. 50 fewer sure merges in all (81, against 131). Listed own foods 443, against 388.
- Parents: `category` "spice" came back 24 times (7 last run), "mixed spices" 0 times (15). 5 powders lost a specific parent (cumin, garlic, chili pepper) for spice, one of them with 41 lines, and 9 blends moved to spice (7 from mixed spices, 2 from mixed condiments). 8 own foods lost a right parent because the parent or category AI gave finds no food (ticket 53's shape).
- Cheaper: reading tokens 698,706 against 977,068 for 579 against 573 readings.

Mike decided the prompt texts on 2026-10-22, so this is his call: put other names and the most specific parent back in the reading's asks (a `.describe()`, or the prompt), or look up the parent's children before filing.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-22)

The two prompt texts (`ingredient-resolution.txt`, `ingredient-match.txt`) stay word for word. In the reading schema's descriptions: `otherNames` goes back to the old wording that gave other names for 71% of foods, and the `parent` description loses the "Not a food that only shares a word" sentence (the model applied it to parents: cumin powder lost cumin for spice, 14 times). The match prompt already holds that rule.

## Implemented (2026-10-22)

- `readFoodSchema` in `packages/shared-server/src/ai/resolution/ingredient-resolution.ts`: `otherNames` is `Two or three other names a shop might sell the same food under ("hot dog sausage" and "wiener" for "frankfurter"), or null when there are none.` (the old prompt bullet, before ticket 56); `parent` is `The plain food a shopper buys that this is made of or sold as ("chocolate whey" is "whey", "rode uien" is "onion"). Null when there is none, or when the name is that plain food itself.`
- Test: `review.test.ts` "looks up the other names AI says a shop sells the food under" also checks the request's JSON schema carries the `otherNames` wording and no "only shares a word".
- Not looked into: the parent's children before filing (the ticket's other option). The next ticket 31 run shows whether the descriptions bring other names and specific parents back.
