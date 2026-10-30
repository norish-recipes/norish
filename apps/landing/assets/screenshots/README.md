# Landing pictures

The sources behind every picture on the page. The page never reads them
directly; `pnpm --filter @norish/landing shots` renders them into
`public/screenshots/optimized` at the sizes `components/shot.tsx` requests.
After replacing any of them, run that script and commit both.

- `*-mobile.jpg`: phone captures, 780x1546 (a 390x773 viewport at 2x), light
  theme, taken from the top of the page with the pointer parked in a corner.
  They are the README's set: Steak Bowls on Thursday October 29, its grocery
  list under Albert Heijn with prices, the pantry, and cooking mode on step 3.
- `recipe-web.jpg`: the Greek Yogurt Naan recipe page scaled to 16 servings,
  3520x2600 (a 1760x1300 viewport at 2x).
- `nora-*.jpg`: photos of Nora, 3:4.

`scripts/capture-shots.mjs` retakes the phone and web screens against a
signed-in account (see the header of that file for usage).
