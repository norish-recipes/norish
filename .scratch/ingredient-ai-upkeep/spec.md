# Ingredient AI upkeep

Status: ready-for-agent

## Problem Statement

The catalogue holds names the Ingredient Words cannot fix ("GR TONIJN UIT BLIK", "heaped cups plain flour"), and the only remedy is renaming them by hand, one at a time. A catalogue may also hold products ("Unox Knaks"), and nothing in the icon request the code owns stops a drawn icon from carrying a brand. An administrator who wants new foods tidied and drawn has to come back and run rounds by hand. Once the Suggestions panel of an Ask AI round is closed and the page reloaded, the list of foods AI was unsure about, passed over or failed on is gone.

## Solution

1. **Unbranded product icons.** The code-owned composition of every icon request says that a food which is a product is drawn as it is sold, in its pack's shape, with no logo, text, brand colours or trademark shape. It holds whatever style the administrator sets, for copyright as much as for looks. The default style prompt drops its "brand packaging" ban, which now contradicts this. Instances that never edited the prompt pick up the new default.
2. **The round's report stays.** The header's Suggestions button also shows while the instance's latest finished round has foods it got no suggestion for. That round is read from the server rather than from the tab that started it, so a reload or another member's tab finds it. Rows for foods since unflagged or deleted drop out. The report lasts until the next round replaces it or job retention removes the job.
3. **Clean names with AI.** A header button on the Ingredients page opens a dialog with a count and a token estimate. It starts a round, a third mode of the Ask AI round, that asks AI for the **Plain Name** of each food that:
   - is not from the seed,
   - has no settled name,
   - has no suggestion waiting.

   AI sees the food's name and its spellings. A different plain name becomes a rename suggestion in the Suggestions panel. A plain name another food already spells becomes a merge suggestion into that food. Confirming a rename renames the food (the old name stays a spelling) and clears its flag. Confirming or dismissing settles the name. One round runs at a time.
4. **Automatic for new ingredients.** Admin → AI processing → AI config gets a multi-select under "Automatic recipe enrichment": **Automatic for new ingredients**, with "Clean the name" and "Draw an icon". The second is offered only when image generation is configured. Both are off by default and follow the AI switch.
   - **Clean the name** runs a background job after a food is minted by someone's action (recipe save or import, grocery, recurring grocery, pantry). It renames the food directly to its plain name, settles the name, and leaves the flag. If another food already spells that name, it leaves a merge suggestion instead.
   - **Draw an icon** draws a new food that would show no icon at all (no own icon, none shipped, nothing to borrow), flagged or not. When cleaning is on too, it draws after the clean.
   - The upgrade backfill, the seed and the recheck never trigger either.

**Settled name.** A food's name is settled once AI gave it its plain name, or a person renamed it, confirmed a proposed name or dismissed one. The recheck's `adoptPlainName` never renames a settled food, and no clean round asks about it.

## Decisions

- No branding is code-owned (composition), never the administrator's prompt.
- A product is drawn as sold, blank, even though a blank carton reads the same for milk, cream and juice.
- Plain Name keeps the language, the brand and variant markers: see `CONTEXT.md`.
- AI never changes an existing food alone; cleaning a new food is part of minting (ADR-0037, amended 2026-10-10).
- A dismissed clean sticks. Ask AI's own behaviour is unchanged.
- Only foods with nothing to show are drawn automatically: no Decision Model call, no drawing a red onion when onion fits.

## Out of scope

- A per-food "clean" button in the Ingredient panel (renaming by hand covers it).
- Redrawing the shipped icon set.
- Changing how Ask AI treats dismissed suggestions.

## Testing

- Unit: composition text, plain-name answer handling (same name → no suggestion, taken spelling → merge), confirm/dismiss settling, recheck skipping settled names, the auto-clean/auto-draw triggers firing only for action mints, the setting gating.
- Web: the Suggestions button shows for a finished round's report after reload; the clean dialog.
- E2E (`ai` project): a clean round leaves a rename suggestion that confirms into a renamed, unflagged food.
- Docs: Ingredients page and AI configuration pages, release notes for the Target Version.

## Comments

- 2026-10-10, implemented on rc/0.25.0-beta. Where it differs from or adds to the text above:
  - Clean names is a third mode (`name`) of the Ask AI round, so it shares the round's queue, progress, Suggestions panel and report. One round runs at a time.
  - A clean question AI answers with the name unchanged settles the name without a suggestion, so the next round does not ask again.
  - Automatic upkeep runs on a new `new-ingredients` queue. The resolver announces new foods through a port (`ingredients/minted.ts`) that the queue listens on from startup, because shared-server may not import the queue. Calls with `{ ai: false }` (the upgrade backfill) never announce.
  - Where a new food's plain name is another food's spelling and a suggestion already waits on the food (a parent from its words, say), the waiting suggestion stays and the name stays unsettled.
  - The default icon style prompt dropped "brand packaging"; the no-branding rule is in the code-owned composition.
  - The AI config form has no tests today, so the new picker is covered by the typecheck only.
- 2026-10-11: Clean names and Ask AI about flagged ingredients are one header button, **Fix catalogue**, whose dialog picks the round: flagged ingredients without a suggestion, every flagged ingredient, or Clean names. Each choice starts the same round mode as before; the server is unchanged.
- 2026-10-11: The dialog's choices are checkboxes over three parts that share no food: flagged ingredients no suggestion waits on, flagged ingredients asked again (replacing their suggestion), and Clean names, which now skips flagged foods since the flag's question comes first. Any parts run as one round, each food asked its own question; tokens are measured per food, so a round that asks both still updates both estimates.
- 2026-10-11: A flagged food the check calls a food of its own is asked its Plain Name next, in the same step. A rename or merge replaces the waiting "distinct" (confirming the rename clears the flag but does not set keptDistinct); a plain name settles and the "distinct" stays; a broken name question leaves the "distinct". The name part still skips flagged foods, since the flag's question now covers them. The step's tokens count toward the flag question's estimate.
- 2026-10-11: Two foods can be proposed the same Plain Name in one round, since a waiting rename holds no name. Confirming the second is still refused as `name-taken`, and its suggestion becomes a merge into the food that took the name, waiting on a person; nothing merges without that confirm.
