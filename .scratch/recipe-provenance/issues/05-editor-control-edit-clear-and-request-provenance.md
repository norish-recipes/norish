# 05 — Editor control: edit, clear, and request provenance

Status: ready-for-agent
Blocked by: 03 — Provenance on the recipe page; 04 — Cuisines on a recipe

Spec: `.scratch/recipe-provenance/spec.md`

## What to build

A recipe editor takes control of provenance. They can correct an inferred origin so their grandmother's recipe is attributed to the country they know it came from, and that correction survives — Automatic Recipe Enrichment never overwrites it. They can clear provenance outright when an inference is simply wrong, rather than only overwriting it. And they can request inference on demand for a recipe imported before this feature existed.

A manual run replaces the whole group, because a deliberate refresh should not be half-blocked by a value the editor no longer wants. While it runs they can see it running; if it fails terminally, they are told, so they know to try again.

## Notes

Provenance is edited as **one atomic group** — country, region, Cuisines, and note together, alongside the other enrichable fields in the recipe form. Atomicity is deliberate: the note explains the whole claim, so letting AI fill Cuisines beside a human-set country would store a paragraph arguing against the field next to it.

Cuisines are chosen from the administrator's vocabulary, so an editor's manual entries match the ones AI produces.

Clearing is an explicit editor action, distinct from an enrichment run writing an empty result. Note that clearing does **not** re-arm automatic inference: automatic enrichment is enrolled once for a newly usable recipe and later edits do not enroll it again. Clear-then-manual-run is the workflow.

Manual availability ignores the automatic switch — turning automation off must not remove an editing tool.

A manual terminal failure is reported to the requester specifically; automatic failures stay quiet and leave the recipe untouched and unmarked.

## Acceptance criteria

- [ ] Provenance is editable in the recipe form as one atomic group: country, region, Cuisines, and note.
- [ ] Cuisines are selected from the current vocabulary rather than free-typed.
- [ ] An editor correction is substantive supplied provenance and is never overwritten by an automatic run.
- [ ] An editor can clear provenance entirely, and clearing is distinguishable from an enrichment run writing an empty result.
- [ ] An editor can request provenance inference on demand, and the request succeeds while the automatic switch is off.
- [ ] A manual run replaces the entire group regardless of what is stored.
- [ ] An in-progress manual run is visible to the editor.
- [ ] A manual terminal failure is reported to the requester; an automatic failure is not surfaced and leaves the recipe untouched.
- [ ] A housemate's correction is what every household member sees.
- [ ] Interface strings are added for every enabled locale and the internationalization gate passes.
- [ ] UI tests cover editing the group, clearing it, and the in-progress state.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Recording whether a stored value came from a person, an importer, or a worker.
- Re-arming automatic inference after a clear.
- Bulk or backfill operations across many recipes — out of scope for this feature.
