# 03: Render-count script and the groceries baseline

**What to build:** A committed script next to `apps/web/scripts/measure-page-loads.ts` that counts, per scripted action, mounts and re-renders per component and the prop that changed, through the React DevTools hook on a dev build (so components have names). The groceries scenario runs these actions: check an item, add an item, open the edit panel, switch the view mode, and a realtime echo from a second client changing an item. The baseline is taken on the current code before 04 lands. See `.scratch/app-structure/spec.md`, "Measurement".

**Blocked by:** 01 for the baseline (so it measures groceries alone); the script itself can start immediately

**Status:** ready-for-agent

- [ ] The script takes a scenario and prints, per action, mounts and updates per component, sorted by count, with the changed props behind each update.
- [ ] The groceries scenario covers the five actions, the echo coming from a second signed-in browser context.
- [ ] Two runs on unchanged code give the same counts.
- [ ] `scripts/README.md` says how to run it in a few lines.
- [ ] The baseline is recorded under `## Comments` here: per-action renders, `/groceries` first paint from `measure-page-loads.ts`, `/groceries` route JS from `next build`, and the code shape (folders groceries spans, lines in web, mobile and shared-react, binding files).
