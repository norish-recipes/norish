# 02 — Provenance: strongest single country, named in the recipe's language

**What to build:** A Dutch recipe about a Turkish dish gets a provenance card titled "Turkije" — the country's written name speaks the language of the note beside it. A dish claimed by several countries always carries the single strongest claim, with rivals acknowledged in the note; only a genuinely unplaceable dish keeps an empty country, and that empty state stays honest and intact.

**Blocked by:** None — can start immediately.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** done

- [x] Recipe Provenance stores a written country name beside the ISO code; inference writes it in the recipe's language, the same way it already writes the note.
- [x] The provenance card titles itself with the stored name; rows with a code but no name fall back to today's endonym rendering.
- [x] A manual country pick stores the label the editor saw in the picker, in their own words.
- [x] The shipped default prompt and output schema instruct: pick the single country with the strongest claim, acknowledge rivals in the note, null only when the dish belongs to no tradition at all. Admin prompt overrides are untouched.
- [x] Flag tooltips, the dashboard flag, and the country picker remain reader-language chrome.
- [x] Harness e2e covers the recipe-language name titling the card, and the null path: an unplaceable dish leaves the section titled "Provenance" with stored data unwiped.
- [x] Prompt-content, repository round-trip, and card fallback behavior are covered beside their existing test suites.

## Comments

- Shipped in 6bb46671. origin_country_name stored beside the code (migration 0038); inference writes it in the recipe's language, manual picks store the picker label; card falls back to the endonym for named-less rows. Default prompt/schema now pick the single strongest claim with rivals in the note, null only for the unplaceable. Prompt-content, repository round-trip, card fallback, and two new harness scenarios (recipe-language heading; null path) cover it.
