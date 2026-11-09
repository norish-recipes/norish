# 07: Measure the pilot and write the release-notes line

**What to build:** The baselines from 03 are rerun on the finished pilot and all three are compared as absolute numbers. Every re-render that remains is traced to a real change on screen; one that isn't is fixed here. If the pilot showed a problem with the shape itself, the spec is amended before the second feature starts. The 0.27.0-beta release notes get one line saying the app architecture changed. See `.scratch/app-structure/spec.md`, "Measurement" and "Migration".

**Blocked by:** 06

**Status:** done

Done at a06b3a4ec. Measured as-is first (3b6cf0947), then fixed what rendered without a change on screen: the `DndContext` wrapper (579f2020b), dnd-kit measuring drop targets while idle (d4430808e), every Store section rendering for one row (f2ff3c9f3), the create's answer moving the rows below it down twice (cee6cb551, a cache bug, with a test), grouped rows rendering for a sort order and version they don't draw (ee967e523), the closed clear modal and the header menu (837425e3f), the recurrence transition (4a620743f) and the panels' lookups catching up (37504a285). Renders, mounts / updates / commits, after the pilot and after 07: check 0 / 269 / 7 to 0 / 106 / 7, add 19 / 1,532 / 13 to 19 / 292 / 11, edit panel 178 / 221 / 8 to 178 / 107 / 5, echo 0 / 228 / 2 to 0 / 60 / 2, view mode 857 / 700 / 10 to 853 / 700 / 10. First paint 628 ms both times (Baseline 2 632 ms), JS 859 then 860 KB gzip (900). The record, with every remaining render's cause, is "After the pilot" in 03; the spec took what the pilot taught (880714bf9) and CONTRIBUTING four rules (cd7d37ea3). Two drags by hand on the measuring server landed and survived a reload.

Left open: the icons context renders all 41 icons when one food joins the list (the recipes migration shares the component); a changed Store renders its unchanged aisles' containers and headings; the ungrouped list and By Recipe keep the old prop shape, and weren't measured; the 41 KB less JS since Baseline 2 isn't traced. The Add panel's link lookup now waits for typing to stop from the first name typed, like every later one. The groceries E2E set, `reorder-and-swipe` and `grocery-aisles` above all, runs after the whole ticket set.

- [x] The after numbers sit next to both baselines under `## Comments` in 03: per-action renders, first paint, downloaded JS, code shape.
- [x] Each remaining re-render per action is listed with the on-screen change that causes it.
- [x] First paint of `/groceries` is no worse than the baseline.
- [x] The spec is amended with anything the pilot taught, or says it held.
- [x] `apps/docs/docs/release-notes/0.27.0-beta.md` has the one line.
