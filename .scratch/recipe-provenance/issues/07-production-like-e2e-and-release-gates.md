# 07 — Production-like E2E and release gates

Status: ready-for-agent
Blocked by: 05 — Editor control: edit, clear, and request provenance; 06 — Cuisine leaves the Tag vocabulary

Spec: `.scratch/recipe-provenance/spec.md`

## What to build

Recipe Provenance is proven end to end against a real stack, and the feature is release-ready. The existing production-like AI browser harness gains provenance coverage: mock only the external AI provider, and use the real server, database, Redis, workers, repositories, authorized mutation layer, realtime connection, and UI.

This is the one deliberately horizontal ticket. Unit and integration coverage lives in the tickets that introduced each piece; what lands here are the cross-cutting flows that only exist once everything else has shipped.

## Notes

Extend the existing harness rather than building a second one — reuse its stack boot, sign-in, AI control and automatic-enrichment toggles. Run it after a clean rebuild.

An environmentally blocked E2E run is reported as **blocked**, not as passed. Say plainly which scenarios ran, which failed, and which could not run.

The quiet-automatic-failure scenario is the one most likely to pass vacuously — make sure it asserts the recipe is genuinely untouched and unmarked, and that nothing is surfaced to the user, rather than merely that no error appeared.

## Acceptance criteria

- [ ] An import enters automatic provenance inference and the result is stored and rendered.
- [ ] Supplied provenance suppresses the automatic run for the whole group, end to end.
- [ ] A manual run replaces the entire group, end to end.
- [ ] An automatic failure is quiet: the recipe is untouched, unmarked, and nothing is surfaced to the user.
- [ ] A rendered recipe updates in place when provenance arrives, without a reload.
- [ ] Only the external AI provider is mocked; server, database, Redis, workers, repositories, mutation layer, realtime and UI are real.
- [ ] Feature documentation is updated and the documentation check passes.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.
- [ ] Every gate and E2E run is reported explicitly as passed, failed, or blocked.

## Non-goals

- Re-testing what the earlier tickets already cover at their own seams.
- Broadening the AI harness beyond what this feature needs.
