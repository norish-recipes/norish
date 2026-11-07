# 07: Measure the pilot and write the release-notes line

**What to build:** The baseline from 03 is rerun on the finished pilot and the two are compared as absolute numbers. Every re-render that remains is traced to a real change on screen; one that isn't is fixed here. If the pilot showed a problem with the shape itself, the spec is amended before the second feature starts. The 0.27.0-beta release notes get one line saying the app architecture changed. See `.scratch/app-structure/spec.md`, "Measurement" and "Migration".

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The after numbers sit next to the baseline under `## Comments` in 03: per-action renders, first paint, route JS, code shape.
- [ ] Each remaining re-render per action is listed with the on-screen change that causes it.
- [ ] First paint of `/groceries` is no worse than the baseline.
- [ ] The spec is amended with anything the pilot taught, or says it held.
- [ ] `apps/docs/docs/release-notes/0.27.0-beta.md` has the one line.
