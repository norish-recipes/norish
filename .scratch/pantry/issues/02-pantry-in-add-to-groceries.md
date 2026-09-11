# 02 — The Pantry in the add-to-groceries panel

Status: ready-for-human
Blocked by: 01

Spec: `.scratch/pantry/spec.md` · Decision: ADR-0032

## What to build

In the recipe's add-to-groceries panel, split the lines whose name (as edited in the panel) is in the Pantry below a separator, under an "In your pantry" heading with its own select-all on the right, unticked. The top count and select-all concern the lines to buy and the pantry's select-all the stocked lines, neither touching the other; when every line is stocked the empty to-buy header and the separator are not shown; the footer Add is enabled when anything at all is ticked; the create payload is unchanged and in recipe order. Selection waits for the Pantry to answer, so a stocked line is never pre-ticked.

## Acceptance criteria

- [x] Stocked lines render under the pantry section, unchecked; the confirm payload leaves them out until ticked; the top select-all leaves them alone and the pantry select-all ticks only them; the footer is disabled until something is ticked (component test).
- [x] A household with no matching item sees no section and everything ticked, exactly as before.
