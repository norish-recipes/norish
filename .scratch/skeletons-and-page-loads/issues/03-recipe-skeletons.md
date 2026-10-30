# 03: Recipe skeletons

**What to build:** The recipe page, the share page and the recipe editor each show one Skeleton in today's shape.

- **Recipe, desktop:** the info card with its full-width cooking-mode button, the ingredients card with its header controls, nutrition and rating as Device Preferences keep them, the hero, the Steps card with a plain heading. No provenance, notes or cookbooks cards (they are optional).
- **Recipe, phone:** today's order and spacing, including the floating-dock clearance and the cooking-mode pill. The favourite circle follows its Device Preference. Optional cards are left out.
- **Share page:** the same skeleton, as today.
- **Recipe editor (edit and new):** the form's sections in its order (Details before Additional Info), with `ml-0 md:ml-9`, and without the header control the form doesn't have.
- Real words: section headings and card titles render through translations.
- The page's own loading branch and `loading.tsx` draw the same skeleton.

See `.scratch/skeletons-and-page-loads/spec.md`, Skeletons. The rule is CONTEXT.md's **Skeleton**.

**Blocked by:** None. The view-transitions work in the checkout touches the recipe skeletons and is committed first.

**Status:** done

- [x] Desktop and phone recipe skeletons match the page at the reader's Device Preferences, checked side by side in a browser on both Device Kinds.
- [x] The editor skeleton matches the form.
- [x] Existing tests that assert skeleton markup are updated; `first-paint.e2e.ts` stays green.

**Done 2026-10-15** (`aa0c7efd2`, `c09b56158`): `recipe-skeleton-parts.tsx` holds the shared pieces (inert Cook and Add buttons, ingredient rows, nutrition card, rating). The share page passes `shared`, which drops the app-only controls. Checked side by side on both Device Kinds against the dev data, editor via a frozen client navigation on a prod build.
