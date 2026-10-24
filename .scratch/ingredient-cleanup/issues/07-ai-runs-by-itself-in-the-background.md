# 07: AI runs by itself in the background

**What to build:** No person starts AI any more.

- **After every mint:** the ingredient review queue runs the pass from 06 on the new foods. The minted-food port feeds it, as it feeds the new-ingredients queue today. The pass follows the AI switch, and uses the Decision where the ingredient-resolution Decision Use is on.
- **At import:** an unsure "same" answer now joins the known food and records an unsure AI Change. Today it mints a flagged duplicate.
- **Icons:** drawing an icon is a separate job on the existing icons queue, queued at the end of a pass for foods that still exist and show no icon, when "Draw an icon" is on. The new-ingredients queue is deleted. The "Clean the name" option under Automatic for new ingredients goes, since naming is part of the pass.
- **Nightly:** the scheduled task queues the pass for foods flagged because AI was unavailable or its key refused. It also sweeps sure AI Changes older than a month. Undone ones are kept as memory, and unsure ones stay until handled.
- **Buttons:** Ask AI, Find parent with AI and the Fix catalogue round are removed from the Ingredients page. Draw icons stays.

See ADR-0037's first 2026-10-17 amendment.

**Blocked by:** 06

**Status:** done

- [x] A recipe import that mints a food queues one pass, which applies AI's answer with no person involved.
- [x] An unsure "same" at import joins the food, and the food shows the unsure change.
- [x] The icon job is queued only for foods that survive the pass without an icon, and only when "Draw an icon" is on. A merged food is never drawn.
- [x] The new-ingredients queue, its worker, its producer and the "Clean the name" setting are gone. A server config that still holds the setting loads without error.
- [x] The nightly task re-asks foods flagged for an unreachable AI, and skips them with AI off.
- [x] Sure AI Changes older than 30 days are swept; undone and unhandled unsure ones stay.
- [x] The Ask AI, Find parent with AI and Fix catalogue buttons, the Fix catalogue modal and their translations are gone. Its component test is deleted.
- [x] Every worker wraps its processor for the model ledger.
- [x] Worker tests cover the queue order (pass, then icons). All `CONTRIBUTING.md` gates pass, and the `ai` E2E project stays green.

## Comments

2026-10-19, implemented:

- The minted-food port queues the pass (`addIngredientReviewJob`) for the foods a mint made, while AI is on. The job holds only the foods, with no actor. When the pass ends, the foods still there that show no icon go to the icons queue. An icons job with no actor draws a food only where it shows no icon at all.
- An unsure "same" at import adds the text's clean spelling to the known food, as an unsure merge AI Change. Its Undo moves the spelling out to a food of its own, named as the spelling, carrying its lines.
- The nightly `ingredient-sweep` deletes sure or kept AI Changes older than 30 days. It then queues the pass for flagged `ai-unavailable` and `ai-key-rejected` foods AI may still ask about.
- Removed along with the buttons, since only a person's round used them: the round's progress and report (`reviewRound`, `reviewReport`, `onReview`, `reviewScope`, `nameScope`), the row's "Asking AI…" chip, and the token estimates (the runtime's estimators too). The job monitor still shows each pass, a step per food.
- The admin form's Automatic for new ingredients is one switch, "Draw icons for new ingredients", hidden without an image provider.
- Every worker starts through `createWorker`, which wraps its processor for the model ledger. Nothing else calls `new Worker`.
- E2E: the fake AI provider gives ingredient questions a lane of their own, picked by the ingredient prompts' system message. `enqueueIngredients` answers them, apart from the chat lane's queue and counts, and an unanswered one is refused at once (400). Without the lane, a pass from one scenario took the next scenario's answers: 6 reds.
- The Clean names browser scenario is now "AI gives a food a recipe mints its plain name by itself", and both pass scenarios wait for stray passes (`waitForAIPasses`) before queueing their answers.

2026-10-19, review fixes:

- AI never overrides a person's decision made while it was asking: a merge, parent, Plain Name or flag checks under its lock that no person kept the food distinct, named it or gave it a parent.
- Icons are queued only for foods AI answered. A food it could not reach waits for the nightly pass.
- A food flagged because no AI could answer for it keeps that reason when an unsure merge or import join lands on it, and when AI is switched off mid-pass, so the nightly pass still asks it.
- Ticket 06's open item is fixed at its root: an unsure "kind of" at import records an unsure parent change (not marked as from the words), so Keep and Undo stand behind the flag.
- An icons job the pass queued does not take over the page's Draw icons button, and nothing announces it as a round.
- The ingredient system messages moved to the leaf `ai/runtime/system-messages.ts`, so the E2E harness matches them rather than copying their text.
- Not changed: the unsure join's Undo memory is keyed on spelling ids, as 06's is, so once the restored food is swept a new spelling can join again.

For ticket 09: `apps/docs/docs/groceries/ingredients.md` (the Fix catalogue section and its screenshot) and `configuration/ai-provider.md` (the Clean the name row) still describe the old buttons. The release notes need: AI asks by itself after every new ingredient and nightly; Ask AI, Check with AI and Fix catalogue are gone; Clean the name is dropped.
