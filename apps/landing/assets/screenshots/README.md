# Landing pictures

The sources behind every picture on the page. The page never reads them
directly; `pnpm --filter @norish/landing shots` renders them into
`public/screenshots/optimized` at the sizes `components/shot.tsx` requests.
After replacing any of them, run that script and commit both.

- `<screen>-mobile-<light|dark>.jpg`: phone captures, 780x1546 (a 390x773
  viewport at 2x): the Steak Bowls recipe, cooking it on step 3, the planned
  week, its grocery list under Albert Heijn with prices, and the pantry.
- `recipe-web-<light|dark>.jpg`: the Greek Yogurt Naan recipe page scaled to
  16 servings, 3520x2600 (a 1760x1300 viewport at 2x).
- `nora-*.jpg`: photos of Nora, 3:4, one version for both themes.

`scripts/capture-shots.mjs` retakes every capture in one run against a
signed-in account (see the header of that file). Keep a set to one session so
the screens tell one connected week.
