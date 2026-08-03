# 09 — Amount-based entry for Step Ingredients

**What to build:** A step's use of an ingredient line can be specified as an amount, not only as a fraction. A recipe that calls for 5 eggs can use 3 in one step and 2 in another, entered as "3" and "2" — never as the shares 0.6 and 0.4, which is how post-ship feedback showed nobody thinks. The stored form does not change: an entered amount becomes the equivalent share of its line at entry time, so displayed amounts stay derived from the live line and keep following edits, the servings control, and the active measurement system. The AI claim gains the same vocabulary: the model may state the amount a step's own words give, and the inferrer does the division.

**Blocked by:** None — extends 04 (chips) and 06 (enrichment), both shipped.

**Spec:** `.scratch/general-improvements/spec.md` — supersedes the share-only wording of user story 9 after post-ship feedback.

**Status:** done

- [x] A chip on a line that has an amount offers **Amount…**: the typed amount is converted to a share of the line at commit (3 of 5 eggs → 0.6) and the input opens prefilled with the chip's current derived amount. A line with no amount keeps the custom share input it has today.
- [x] A chip using part of an amounted line is labelled with the derived amount and unit ("2.5 g salt"), matching what readers see beneath the step; full-share chips keep the bare name, amountless partial chips keep the fraction label.
- [x] The chips row resolves amounts against the editor's active measurement system, so an entered amount means the system the editor is looking at.
- [x] Nothing about storage, transport, or reading surfaces changes: shares remain the stored form, and every displayed amount is still derived at the moment of display.
- [x] The AI claim may state `amount` instead of `share` per linked line; the inferrer converts by the line's own amount, clamps to the whole line, and falls back to the stated share (or the whole line) when the line has no amount. The prompt teaches stated amounts; the schema keeps prompt-numbering discipline.
- [x] The harness e2e proves an amount-stated claim lands as the equivalent share and renders the same derived amounts on the reading surfaces.
- [x] Docs, release notes, and the glossary say amounts are entered as amounts and stored as shares.

## Comments

- Filed from post-ship feedback on the general-improvements branch: "some recipes call for 5 eggs and use 3 in step 1 and 2 in step 4 — this is not possible now." The share model itself is untouched; this is an entry-vocabulary gap, on both the human path (chips) and the AI path (claims).
- Shipped on general-improvements. Editor: chips accept amounts for amounted lines, labels show derived amounts, lines resolve per active system, i18n in all 13 locales. AI: claim entries carry nullable share/amount, inferrer divides and clamps, worker passes numeric line amounts, prompt + prompt tests updated. E2E: the water link now enters the stack as amount 25 and lands as share 0.5. Docs, release notes, and glossary updated.
- Decisions from review: (1) Human entry is deliberately not clamped to the line — typing 7 on a 5-egg line stores share 1.4 and the chip immediately reads "7 eggs", visible feedback being preferable to silent correction; only the AI path clamps, because a model overshoot has no one watching. (2) On an amounted line, **Amount…** replaces the custom-share input outright: every share of an amounted line has an exact amount equivalent, so a second entry mode would only add a mode picker. (3) Editor chips show the stored unit ("ml") while reading surfaces localize ("milliliters") — the editor shows the stored form, like its ingredient rows. Review also extracted the shared `toLineAmount` helper (chips + worker), made closing an untouched entry input a no-op so the rounded prefill cannot drift a stored third into 0.3334, and added the `editor-amount-entry` docs screenshot.
