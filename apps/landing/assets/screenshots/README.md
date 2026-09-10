# Landing screenshots

These JPGs are the source captures behind the tour deck. The page never reads
them directly; `pnpm --filter @norish/landing shots` renders them into
`public/screenshots/optimized` at the exact sizes `components/shot.tsx`
requests. After replacing any capture here, run that script and commit both.

`hero-dish-{light,dark}.jpg` is the odd one out: a photograph rather than a
capture, the dish in the hero's recipe fragment. It is the recipe's own photo
at the largest size its site publishes, 440x195 once cropped to the fragment's
band, and the dark variant is the same frame at 0.87 brightness so it does not
glare over the dark ground. Because 440 is all there is, the 2x variant the
optimizer writes is an upscale it sharpens rather than detail — a hero photo
that has to hold more than about 440 CSS pixels needs a different photograph,
not a bigger export.

## The capture spec

Every screen ships four captures, named `<screen>-<web|mobile>-<light|dark>.jpg`:

- **web**: 1800x1350 (a 900x675 viewport at 2x); the recipe page alone is
  2400x1800 (a 1200x900 viewport at 2x) — the same 4:3, but physically wider
  so the page shows itself with room to breathe
- **mobile**: 780x1546 (a 390x773 viewport at 2x), with the dashboard's
  recipe library in list view

The optimizer centre-crops anything with a different aspect and warns, because
a mismatched size almost always means the capture came from a different
session than the rest of the set.

`scripts/capture-shots.mjs` takes all twenty in one run against a signed-in
account (see the header of that file for usage). It also handles the staged
detail that cooking mode is captured on step 2, whose ingredient chips sit
under the instruction. The groceries page no longer needs staging: a list
under one Store, sorted by aisle, fills the frame on its own.

## One instance, one story

All twenty captures come from one session (2026-08-12, the `mike@vanes.dev`
account on a local dev instance), so the deck reads as one household using
one app:

- today (Wednesday, August 12) holds two meals: smoky pork & Boston beans
  one-pot for lunch, a ham & cheese Dutch baby pancake for dinner
- the recipe page and cooking mode are that same smoky pork one-pot, today's
  lunch, captured on step 2 with the step's own ingredient chips (the bread
  and the parsley) under the instruction
- the hero fragment and its dish photo are that same recipe again
- the grocery list is Dirk's, sorted by aisle and priced from the shop's own
  pages: a Sale on the goat's cheese, bananas by the kilo, the weekly milk
  recurring and due today, one item already ticked away into the done row
- the rest of the week's dinners are already planned, boerenkoolstamppot on
  Thursday and more through Saturday

When retaking, keep it to one signed-in account on one day, keep every visible
recipe photographed, and keep a week planned that tells the same connected
story: the dish you open is the dish you cook, plan and shop for.

The four groceries captures are the exception, retaken on 2026-09-10 when the
list gained aisles and prices: they come from the E2E production stack and
its harness-served shop, with the same avatar, because the local dev login
was unavailable. The spec that takes them is kept at
`.scratch/redesign-groceries-page/landing-shots.e2e.ts`.
