# 76: AI gives several parents, in English and in the name's language

**What to build:** Ticket 73's analysis (2026-10-23): of the 23 listed own foods without a parent in m70a/m70b, 15-17 have a parent AI named that the catalogue holds under another wording ("salad dressing" for dressing, "bun" for bread roll, "spice mix" for mixed spices, "bouillon cube" for broth) or only in Dutch (kipgehakt, zoete aardappel friet, ingelegde rode ui). AI gives one English parent, so one wording decides.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

"perhaps make it give back a couple of parent options so we can test multiple... parents become an array and we have native parents as well... we just need to change the json a bit." And: "if both match we prefer native."

- The reading's `parent: string | null` becomes `parents: string[]`, two or three wordings, the most specific first, and gains `nativeParents: string[]`, the same in the name's own language. Rules stay in the fields' `.describe()`; the prompt text stays lean (only where it names the field).
- The parent lookup tries the native parents first, then the English ones, in AI's order: the first that finds a food is the parent. Through the existing lookup (`parentOf` → `findByName`/`findFood`), one query for all names.
- Every rule that compares with AI's parent compares with any of them: ticket 63's other name that is the parent (`sameFood`/`wholeFoodKey`), ticket 65's last words of the current parent, ticket 56/57's found food that is the parent, ticket 53's kept AI parent. The category stays as it is.
- No extra AI request. Measured in the final run by the named foods (mager kipgehakt, ovenfriet zoete aardappel, zoetzure rode ui, the "bun"/"spice mix"/"bouillon cube"/"salad dressing" cases), not by the total, which moves within its noise band.

## Implemented (2026-10-23)

- The reading's `parent` is `parents` and `nativeParents` (`readFoodSchema` in `ai/resolution/ingredient-resolution.ts`), nullable string arrays as `otherNames` is, read into `string[]`. Field rules in `.describe()`; the prompt changed only in its "Parent:" paragraph. `ReviewTrace` carries `parents` and `nativeParents` in place of `parent`.
- `parentOf` takes `[...nativeParents, ...parents]`: one `findFood` call for all, the first name that finds a food is the parent, its result picked as one name's is (`pickAmong`, split out of `findNamed`; slips still asked). One that finds the food AI's names found goes first, so ticket 56's "never merged into a parent AI gave" holds for any of them. Ticket 65's last-words check, 63's `parentNamed` and 53's kept parent compare with any. Category unchanged.
- The second question shows the English parents: Decision state `parents`, the match prompt's line `Parents: a, b`. `present` drops empty lists now as it drops nulls.
- Tests: `review.test.ts` "AI's several parents, in the name's language and in English" (mager kipgehakt under own kipgehakt, burger buns under bread roll, native preferred, italian sausage under sausage though braadworst is its native parent). Fixtures (`helpers/ingredient-readings.ts`, the E2E spec's two readings) build `parents`/`nativeParents`.
- Release-notes line after the "chocolate whey stays under whey" parent line, the 0.26 prompt Upgrade note names the new fields, ADR-0037 amendment.
