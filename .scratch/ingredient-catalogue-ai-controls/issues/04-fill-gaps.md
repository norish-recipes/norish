# 04 Fill gaps button, and the per-user Draw icons round goes

Status: ready-for-agent
Blocked by: 02, 03

Spec: Solution 5, 7

## What

- In the Ingredient catalogue section beside Clean up catalogue, a **Fill gaps** button opens a dialog with checkboxes Nutrition, Conversions, Icons, each with how many listed foods it would fill (Icons only when image generation can draw). Confirm starts one job, visible and cancellable in the Job queue.
- Gap only: a food with its own value for a field (dataset, fix, correction, earlier AI estimate) is never asked for it; Icons are for foods that show none (`listFoodsShowingNoIcon` rules: broad groups left without one stay without). Listed foods only, seeded included, grocery-only foods out.
- Remove the Draw icons control, modal and round from the Ingredients page (`draw-icons-control.tsx`, `draw-icons-modal.tsx`, `ingredients.drawIcons`/`iconScope`, `listIconRoundFoods` scopes no longer used). Single-icon Generate in the food's icon menu stays.

## Acceptance

- Count and fill tests: gap-only writes, seeded included, grocery-only excluded.
- E2E (`ai` project): Fill gaps for nutrition gives a food without dataset numbers an "Estimated by AI" value.

## Comments

- 2026-10-24, implemented in d4181e4e0. Differences: Confirm queues up to two jobs, both named `fill-gaps` (a fill job on `ingredient-fill` for Nutrition and Conversions, an icon job on `ingredient-icons` for Icons), each visible and cancellable in the Job queue; one Fill gaps run at a time across both. Nothing is ticked when the dialog opens, and a box with nothing to fill is disabled. The Icons box shows only where `canDrawImages` (the counts procedure answers `icons: null` otherwise). `listFoodsShowingNoIcon` now leaves out the shipped set's vague groups itself, which Fill gaps needed over seeded foods. With the round gone, the icon job has no `actor`, the `icons` realtime event, `onIcons`, `iconRound`, the rows' drawing spinner, `drawRoundIcon` and `setDrawnIcon` went too; `listIconCatalogue` stays for the icon tool. Clean up catalogue and Fill gaps share one dialog shell (`catalogue-ai-run.tsx`) and one queued-job check (`hasQueuedJobNamed`). Open: run with three local workers, the ai E2E timed out under load (Valkey socket timeouts, 10 to 40 s requests, the pre-existing Clean up spec too); with `--workers=1 --repeat-each=3` all 21 passed.
