# 03: Render-count script and the groceries baseline

**What to build:** A committed script next to `apps/web/scripts/measure-page-loads.ts` that counts, per scripted action, mounts and re-renders per component and the prop that changed, through the React DevTools hook on a dev build (so components have names). The groceries scenario runs these actions: check an item, add an item, open the edit panel, switch the view mode, and a realtime echo from a second client changing an item. `measure-page-loads.ts` also reports the JS a page downloads, since Next 16 dropped route sizes from `next build`. Two baselines are taken: one on the current code before 01, and one after 01 and before 04, so the groundwork's rewrite of Device Preferences, which the view-mode action reads, shows apart from the pilot. See `.scratch/app-structure/spec.md`, "Measurement".

**Blocked by:** None for the script and the first baseline; 01 for the second baseline

**Status:** ready-for-agent

- [ ] The script takes a scenario and prints, per action, mounts and updates per component, sorted by count, with the changed props behind each update.
- [ ] The groceries scenario covers the five actions, the echo coming from a second signed-in browser context.
- [ ] Two runs on unchanged code give the same counts.
- [ ] `scripts/README.md` says how to run it in a few lines.
- [ ] `measure-page-loads.ts` reports the JS bytes each page downloads, added up from its script responses.
- [ ] Both baselines are recorded under `## Comments` here: per-action renders, `/groceries` first paint and downloaded JS from `measure-page-loads.ts`, and the code shape (folders groceries spans, lines in web, mobile and shared-react, binding files).
