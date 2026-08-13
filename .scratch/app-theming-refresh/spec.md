# App theming refresh, Hidden Items and first paint

Status: ready-for-agent

## Problem Statement

The landing page was rebuilt and settled on a look the product does not have. It stands on a soft beige ground in light and a warm brown one in dark, with white cards lifting off the page, warm borders, and warm muted text. The app it advertises still sits on a near-neutral green-grey ground with grey borders. Arriving at the app from norish.dev feels like arriving at a different product.

Underneath that, four things are wrong in their own right.

The sign-in page is the first screen anyone sees and there is nothing to it: a bare card centred on a flat background, the wordmark squeezed into the heading beside the title, and failures reported as a red sentence under the form. Pressing Sign in cuts hard to the app with no hand-off at all.

Chips have no single rule. A chip that names a Tag, a chip that reports a failed job, and a chip floating on a recipe photo are all styled differently and none of them agrees with the landing's treatment. There is a selected-versus-unselected pattern in the filters panel that nothing else follows.

Web chrome has drifted into imitating glass — `backdrop-blur` behind a half-opaque fill in roughly twenty-five places, with four shared tokens encouraging more. On the web that imitation does not land: it produces a muddy wash rather than a material, costs compositing while scrolling, and leaves text contrast at the mercy of whatever passes underneath. The floating bottom bar is the worst of it, and it is two separate pieces that happen to line up rather than one object.

Separately, the recipe page has grown long. A cook who never reads Recipe Provenance, never checks Nutrition Information, and never writes notes still scrolls past all three to reach the steps, and there is no way to say so. Three display preferences already exist as individual switches in settings, so the pattern is there but it is scattered and it does not cover the sections that make the page long.

A different class of defect runs across all of this: the app forgets what it knows about the reader until after the first paint. Device choices — the groceries view, ingredient grouping, Today's meals visibility, fraction-or-decimal amounts, the library filters — live in browser storage the server cannot see, so the server renders a default and the client re-arranges the page a frame later. A reader who hid Today's meals watches the whole block paint and vanish on every load, taking the dashboard below it along; a reader who shops by recipe watches the store-grouped list swap out; a reader who works in decimals watches every recipe's fractions flip. The library's grid-and-list choice already made the move to a cookie for exactly this reason; everything else still flickers.

The Admin tab in settings is the same failure through a different door. Whether the reader is an administrator is already on the session the server resolves for every page, but the tab is gated on a client-side round trip that asks again, so the tab list changes shape moments after settings opens — and a warm query cache makes the delay intermittent, which reads as flakiness rather than design. And Hidden Items, as specified above, would join this class the day it ships: stored server-side but fetched client-side, a hidden rating would flash and vanish exactly as the localStorage preferences do today, with the network standing in for localStorage.

## Solution

One warm ground for the whole product. The shared theme token file adopts the landing's warmth so web, landing and the native app stand on the same paper: beige page against white cards in light, warm brown in dark, with borders, separators, muted text and every near-neutral surface warmed to match at unchanged lightness. Foregrounds and the semantic palette are untouched — warm ground, neutral ink.

Chips get one rule. A chip that **names** a thing is uniform: filled in the accent colour when it is active, soft warm fill when it is not. A chip that **reports a condition** keeps its semantic colour, because there the colour is the information.

Fake glass goes, entirely. Every blur and every see-through fill leaves the web app, including over photos, and anything that floats becomes a real opaque object drawn from the token set. This is recorded as ADR-0020, and the shared glass tokens are deleted so there is nothing left to reach for. The bottom bar becomes one solid object with the account avatar joining as a fourth item and a filled pill marking where you are.

The sign-in page takes the landing's treatment — warm ground, the wash behind it, the wordmark standing on its own, a serif heading, and the small ingredient line drawings from the landing in the margins. Failures become proper alerts with an icon and a title. Signing in with a password hands over to the app in one continuous movement; every other route arrives with the same entrance played once.

HeroUI moves to 3.2.4, whose Tabs list container gained the segmented appearance and built-in overflow affordances the app was hand-rolling. The handrolled segmented control is deleted and the library view switch is rebuilt on Tabs.

Finally, **Hidden Items**: one multi-select in settings holding everything a reader would rather not be shown — Recipe Provenance, Nutrition Information, notes, ratings, favourites, the measurement conversion control, and recipe timers. Everything is shown by default. Hiding is that reader's own view and suppresses the item everywhere it would appear for them, while settling nothing about the recipe itself. The origin flag beside a recipe's title is chrome, not Recipe Provenance, so it survives.

And the first paint tells the truth. Device preferences move onto cookies — the one kind of device state the server can read while it produces the HTML — behind a single shared helper, so groceries arrives in the stored view and grouping, Today's meals is simply absent when hidden, and amounts arrive in the reader's format. The Admin tab derives from the session the server already resolved rather than a follow-up question, so the tab list is complete on its first frame. The library filters, too structured to ride in a cookie, hold the library's loading presentation until they are applied instead of painting the unfiltered collection. And Hidden Items is seeded into the first render on every load path, so hiding something means never seeing it — not seeing it briefly.

## User Stories

### The warm ground

1. As a cook, I want the app to stand on the same ground as norish.dev, so that arriving from the marketing site feels like the same product rather than a different one.
2. As a cook reading in daylight, I want a soft beige page behind white cards, so that recipe content lifts off the page instead of blending into it.
3. As a cook reading at night, I want a warm brown ground rather than a cold grey one, so that the app feels calm in a dark kitchen.
4. As a cook, I want borders, separators and muted text warmed along with the page, so that nothing reads grey against beige.
5. As a cook, I want popovers, dropdown menus and input fields to match the cards they open over, so that no surface looks like it was borrowed from another app.
6. As a cook, I want scrollbars and segmented controls to sit in the same family, so the warmth is not betrayed by the last few details.
7. As a cook, I want body text and headings to stay neutral and high-contrast, so that warmth never costs me legibility.
8. As someone using the native app, I want the same ground there, so the phone and the browser read as one product.
9. As a maintainer, I want the landing to stop carrying its own override block, so there is one place the product's ground is defined.

### Chips

10. As a cook, I want every chip that names something to look the same, so I can tell at a glance which chips are labels and which are telling me something.
11. As a cook filtering my library, I want a selected filter chip filled in the accent colour, so I can see what I have chosen without reading each one.
12. As a cook, I want an unselected chip to carry a visible soft fill, so it reads as a control rather than as loose text on the page.
13. As a cook with allergies, I want allergy chips to keep their warning colour, so the one chip I must not miss still separates itself from the rest.
14. As a cook, I want Tag, Cuisine, time and servings chips to share one treatment, so the recipe card reads as a row of labels rather than a colour chart.
15. As an administrator, I want job status, sync health, role and env-managed chips to keep their semantic colours, so a failed job still reads as failed at a glance.

### Glass

16. As a cook, I want floating elements to be solid, so text on them is legible whatever happens to be scrolling underneath.
17. As a cook, I want chips on a recipe photo readable over a bright plate and a dark pan alike, so cooking time and Tags are always legible.
18. As a cook on an older phone, I want no blur compositing while I scroll my library, so scrolling stays smooth.
19. As a cook, I want lightbox and video controls to be solid, so the controls do not shimmer against a moving picture.
20. As a maintainer, I want fake glass to be hard to reintroduce by accident, so the app does not quietly drift back to it.
21. As a maintainer, I want the reasoning recorded, so nobody re-adds blur over photos thinking it was an oversight.

### The bottom bar

22. As a cook on a phone, I want the bottom bar to be one object rather than two pieces that line up, so it reads as a single piece of chrome.
23. As a cook on a phone, I want the section I am in marked with a filled pill, so I can see where I am without reading the labels.
24. As a cook on a phone, I want my account reachable from the same bar, so there is only one floating thing to aim at.
25. As a cook reading a long recipe, I want the bar to keep getting out of the way as I scroll, so it never covers the step I am on.
26. As a cook, I want the bar to keep its safe-area spacing, so it never sits under the home indicator.
27. As a cook, I want opening the account menu to keep the bar in place, so the thing I tapped does not slide away underneath the menu.

### Signing in

28. As a returning cook, I want the sign-in page to look like the site I just came from, so I know I am in the right place.
29. As a new user, I want the sign-in page to have some warmth and character, so the product's first screen is not a bare form on a flat background.
30. As a cook, I want the wordmark standing on its own above the form, so the page has a clear top rather than a logo wedged into a sentence.
31. As a cook, I want sign-in failures presented as a proper alert with an icon and a title, so I can tell what went wrong at a glance.
32. As a cook who mistyped a password, I want the error to appear without clearing the email I already typed.
33. As an administrator with no providers configured, I want that reported as clearly as any other failure, so I know it is a configuration problem and not my credentials.
34. As a cook signing in with a password, I want the page to hand over to the app in one continuous movement, so signing in feels like arriving rather than cutting.
35. As a cook signing in through an identity provider, I want the app to arrive gently even though the page loaded fresh, so both routes feel like the same gesture.
36. As a cook, I want the arrival to play once and then stop, so ordinary navigation afterwards is not animated.
37. As a cook who has asked for reduced motion, I want the hand-off and the drawings to stand down, so the app respects my system setting.
38. As a cook creating an account, I want the sign-up page to match the sign-in page, so the two read as one flow.
39. As a cook who has landed on an auth error, I want that page to match as well, so an error does not look like a different application.
40. As a cook who has not signed in yet, I want the language selector still reachable, so I can read the form in my own language.

### Library view switch and settings tabs

41. As a cook, I want the grid and list switch to look like the rest of the app's tabs, so the library header does not carry a one-off control.
42. As a cook using a keyboard, I want the grid and list switch to behave like a standard tab control, so arrow keys do what I expect.
43. As a cook on a narrow phone, I want the settings tabs to show me there is more to scroll to, so I do not miss a whole section of settings.
44. As a maintainer, I want the HeroUI version declared in one place, so the workspace catalog stops disagreeing with what is installed.
45. As a maintainer, I want the handrolled segmented control deleted rather than left beside its replacement, so there is one way to build this control.

### Hidden Items

46. As a cook, I want to hide the parts of the recipe page I never read, so the page is shorter and I reach the steps sooner.
47. As a cook, I want to hide Recipe Provenance, so recipes whose origin I already know do not carry a card explaining it.
48. As a cook who hides Recipe Provenance, I want the origin flag beside the title to stay, so I keep the at-a-glance signal without the card.
49. As a cook not tracking nutrition, I want to hide Nutrition Information as one thing, so calories, fat, carbohydrates and protein all go together rather than leaving one tile behind.
50. As a cook who keeps recipes clean, I want to hide notes, so a recipe with a long note does not push the steps down the page.
51. As a cook who does not rate recipes, I want to hide ratings, so I am not asked to rate something every time I finish reading.
52. As a cook who does not use favourites, I want to hide them, so no heart appears on cards or recipes.
53. As a cook who only ever cooks in one measurement system, I want to hide the conversion control, so the ingredients header is simpler.
54. As a cook, I want everything shown by default, so I only ever lose what I explicitly chose to lose.
55. As a cook, I want to pick several at once from a single control, rather than hunting down a column of separate switches.
56. As a cook, I want hiding to apply wherever that thing appears, so hiding ratings also takes away the rating filter I would never use.
57. As a cook, I want hiding to change only my own view, so the rest of my household still sees everything.
58. As a cook, I want hiding to settle nothing about the recipe, so I can still open the editor and correct a wrong origin country.
59. As a cook, I want Recipe Enrichment to keep running for kinds I have hidden, so unhiding later shows me values that are already there rather than starting from nothing.
60. As someone opening a shared recipe link, I want to see the whole recipe, because I have no preferences of my own.
61. As a cook, I want my choices to follow me between my laptop and my phone browser, so I set them once.
62. As a cook, I want a hidden section to leave no gap, divider or empty heading behind, so the page closes up properly.
63. As a cook using the native app, I want nutrition still shown there for now, so nothing disappears from a screen that was not part of this change.
64. As a cook who never uses step timers, I want to hide recipe timers, so no step, library card or filter offers me a timer I will not start.
65. As a cook on a deployment whose administrator switched timers off, I want the timers entry not offered — and a choice I made earlier kept rather than erased — so the control never lists what cannot appear and never loses what I chose.

### First paint

66. As a cook who shops by recipe, I want the groceries page to open in the recipe view, so the store-grouped list never paints first and swaps out under my eyes.
67. As a cook who turned off ingredient grouping, I want grocery rows ungrouped from the first frame, so merged rows never split apart in front of me.
68. As a cook, I want my groceries view and grouping choices to survive a reload and a browser restart, so I choose once and the page stays chosen.
69. As a cook who hid Today's meals, I want the dashboard to arrive without it, so the block never flashes in and yanks my library up the page.
70. As a cook who shows Today's meals only when something is planned, I want that rule applied before the page paints, so an empty day never shows the block for a frame.
71. As a cook, I want the Today's meals select in settings to keep working exactly as it does, so only the flicker goes, not the control.
72. As a cook who prefers decimals, I want ingredient amounts to arrive as decimals, so fractions never paint and flip while I am reading.
73. As a cook, I want the amount toggle itself to show my choice on first paint, so it does not need a disabled stand-in while it finds out.
74. As a cook who reads the library as a list, I want that choice to keep arriving pre-rendered as it does today, so the shared helper underneath changes nothing I can see.
75. As an administrator, I want the Admin tab present the moment settings paints, so the tab list never changes shape in front of me.
76. As an administrator following a link straight to the admin section, I want to land on it directly, with no intermediate fall-back to another tab.
77. As a household member who is not an administrator, I want settings to spend no request finding that out, so the page has nothing to wait for.
78. As a cook who left filters active, I want the library to come back already filtered, so recipes I filtered away never flash into view and disappear.
79. As a cook with no filters stored, I want the library to paint as promptly as it does today, so the fix costs nothing when there is nothing to apply.
80. As a cook who hid ratings, I want them absent from the very first frame everywhere, so hiding is a fact of my app rather than something I watch happen on each load.
81. As a cook opening the app offline, I want my hidden list applied from the persisted cache, so hiding holds without the network.
82. As a cook who just changed a preference, I want a navigation answered by the service worker's cached page to settle on my current choice, so a stale copy cannot revert a toggle I just made.
83. As a cook using the offline shell, I want every one of these choices honoured there too, so first-paint fidelity is not an online-only feature.
84. As a maintainer, I want one shared way to make a device preference server-readable, so the next preference is a declaration rather than another hand-rolled cookie.
85. As a maintainer, I want first-paint fidelity asserted in the browser harness, so a regression back to flicker fails a gate instead of waiting for a reader to notice it.

## Implementation Decisions

### The warm ground

- The shared Tailwind theme token file is edited directly rather than layered over. It is the single definition of the product's ground and is consumed by web, landing and the native app.
- The landing's own override block is deleted. Its values become the defaults, so the landing renders identically before and after and there is one place the ground is defined.
- Light warms the page, borders, separators, muted text and the default fill, and deliberately leaves surfaces pure white. The contrast between a beige page and a white card is what gives the app its lift; warming surfaces too would flatten it.
- Dark warms the page, the surface, borders, separators, muted text and the default fill.
- The near-neutral tokens the landing never needed follow the same treatment at unchanged lightness: the secondary and tertiary surfaces, the scrollbar, the segment fill, and the field placeholder. In dark, the overlay and field background track the surface — they share its lightness exactly, so warming the surface alone would leave popovers and inputs visibly cooler than the cards they sit on.
- Foregrounds, the accent, focus, and the success/warning/danger/nutrition families are untouched. The rule is warm ground, neutral ink.
- The documentation site hand-ports these values into its own stylesheet and is knowingly left stale. It sits outside the workspace, so no gate would catch a mistake there, and re-porting it is not part of this work.

### Chips

- Chips divide by what their colour is doing. A chip that **names** a thing carries no meaning in its colour and is uniform. A chip that **reports a condition** keeps its semantic colour, because there the colour is the information.
- Uniform chips take the pattern the filters panel already uses: accent-filled when active, soft warm fill when not. Plain chip text softens so it reads as a label rather than as body copy at chip size.
- The uniform set is the filter categories and Tags, recipe card Tags, time and servings, Cuisine chips on the Recipe Provenance card, Step Ingredient chips, and the editor's Tag chips.
- The semantic set keeps its colours: allergy Tags, job status, CalDAV sync and connection status, household roles, API and site token state, the env-managed badge, and the unsaved-changes, restart-required and new-feature chips.
- The existing override that gives tertiary chips a visible background is retained; it is what stops an unselected chip disappearing into the page, and the warmed default fill is what makes it read warm.

### Glass

- Recorded as ADR-0020. Every `backdrop-blur` and every see-through fill is removed from the web app, including over photos and video.
- The four shared glass tokens are deleted. Their absence is the enforcement: with no shared token to reach for, re-adding glass means writing it out by hand.
- Anything that floats becomes an opaque object from the token set — surface fill, border, shadow. Over a photo that means a surface-filled chip with a shadow rather than white text on a tinted scrim; allergy chips keep their warning fill, which was already carrying its weight with colour.
- Lightbox, video player and carousel controls become solid near-black. They sit over real media, which is exactly the case a narrower rule would have protected, and they are the clearest illustration of why the narrower rule was rejected.
- Modal backdrops that dim the page stay. Those are a scrim over content, not a surface pretending to be a material.
- The decision is scoped to the web. The native app keeps its platform blur, which is a real compositor effect with real material semantics.

### The bottom bar

- The bar becomes one object. The account avatar joins the navigation items as a fourth entry rather than living in its own circle beside them.
- Fill is a solid surface with a border and a shadow.
- The active item gets a filled pill behind it, in addition to the accent text it already gets.
- Auto-hide on scroll is retained unchanged, including the rule that the bar stays put while the account menu is open.
- Safe-area inset spacing is retained.
- The account menu now anchors to an item inside the bar rather than to a standalone button. Its popover positioning must be re-checked against the app's existing panel-overlay rules.

### Signing in

- The sign-in page keeps its single centred card and gains the landing's treatment: the warm ground, the radial wash behind the card in light only, the wordmark standing above the card rather than inside the heading, a serif heading, and the landing's deep soft shadow on the card.
- The serif face used by the landing becomes a web app dependency, for the auth headings only. Body copy stays on the existing sans face.
- The five small ingredient line drawings move out of the landing into a shared package, and the rules that draw them move beside the shared theme tokens. The landing keeps its scroll-driven reveal and parallax; the web app draws them on mount, because a sign-in page does not scroll and the scroll machinery would be dead weight there.
- Sign-up and the auth error page inherit the treatment. They are one flow and should not diverge.
- Auth failures become alerts with an indicator and a title, using the library's alert component, which the app does not currently use anywhere. This is scoped to the auth pages; the roughly fifty other places that report errors as a bare red sentence are deliberately left alone.
- Field-level validation stays inline under its field. It belongs to the field, not to a banner.
- Credential sign-in wraps the client-side navigation in a view transition, so the card and the drawings cross-fade into the app shell as one movement. The landing already drives the same API for its theme toggle, so this is established ground.
- Provider sign-in navigates the whole document away and returns as a cold load, so there is no outgoing page to transition from. It gets the arrival half only.
- The app shell therefore plays a one-off entrance on its first authenticated paint, driven by a just-arrived signal that is read once and cleared, so ordinary navigation afterwards is not animated.
- Every animation added here stands down under reduced motion, matching how the landing treats its own.

### HeroUI 3.2.4 and Tabs

- The workspace catalog is corrected to 3.2.4 for both HeroUI packages and the web app consumes the catalog entry instead of its own literal version. The catalog currently names a version nothing uses, which is worse than having no entry.
- The quick-import extension stays on its pinned beta. It sits outside the workspace, so no gate covers it, and moving it from beta to stable is separate work.
- The handrolled segmented control is deleted. Its only consumer is the library view switch.
- The library view switch is rebuilt on Tabs, with the grid and list presentations each in a real tab panel so the tab list has something to control. In 3.2.4 the tab list container gained the filled pill appearance the handrolled control existed to provide.
- The settings tabs drop their hand-rolled horizontal overflow handling in favour of the component's own overflow affordances, which 3.2.4 added.
- Cooking mode is already on Tabs and is not touched.
- The upgrade changes roughly two thirds of the library's component stylesheets, and this app hand-overrides library internals for chips, dropdown popovers, menu items and form controls. Those overrides need re-checking against the new stylesheets as part of the upgrade, not afterwards.

### Hidden Items

- A single preference holds what the reader has hidden, as a list of item names. Absent or empty means everything is shown, which is exactly the intended default, and an unrecognised entry is ignored so a future hideable item costs nothing at the contract level.

  ```
  hidden: ("provenance" | "nutrition" | "notes"
         | "rating" | "favorites" | "conversion" | "timers")[]
  ```

- The three existing display booleans are removed from the preferences contract and from all their consumers. There is deliberately no backwards compatibility: no fallback read, no backfill migration. A reader who had previously hidden ratings or favourites sees them once more and can re-hide them from the new control.
- Hiding suppresses an item **everywhere it would appear for that reader**. Recipe Provenance, Nutrition Information, notes and the conversion control only appear on the recipe page, so hiding them is what makes that page slimmer. Ratings and favourites also appear on library cards and in the filters panel, and hiding them there is behaviour that exists today and is preserved exactly.
- The origin flag beside a recipe's title is chrome rather than Recipe Provenance, per the glossary, so it is unaffected by hiding provenance. That is a consequence of what the terms mean, not a special case in the code.
- Nutrition Information is hidden as one atomic group. The glossary defines it as calories, fat, carbohydrates and protein together and warns against "Macros" precisely because that word excludes calories; the term does not enter the product, the settings copy, or the translation keys.
- Recipe Provenance and Nutrition Information already have visibility predicates that both their own cards and the page layouts consult, so that the rules drawn between sections come from the same answer the section renders by. The reader's choice is added inside those predicates, which keeps the section rules correct for free. Notes gains an equivalent predicate rather than being special-cased inline in each page layout.
- Hiding is a reading preference only. The recipe editor is untouched, and Recipe Enrichment continues to run and store for hidden kinds, so unhiding reveals values that are already there.
- Shared recipe pages are read by people who are not signed in and have no preferences, so they show everything.
- The preference is stored server-side with the rest of the user's preferences, so it follows the reader between devices.
- The settings preferences card replaces its four switches with one multi-select. Language and today's-meals stay selects; today's-meals is a three-state placement rule, not a hide, and it is device-local rather than server-side.
- Recipe timers join the hidden list as the reader's own layer over the administrator's deployment-wide timers capability. When the administrator has switched timers off there is nothing to offer, so the control does not offer the entry. A control never drops a stored choice it was not in a position to show: it writes back what the reader chose plus what it carried, which covers a timers choice while the capability is off and an entry from a newer version alike. This carried/selected split came out of the implementation and is what makes "an unrecognised entry is ignored" safe in the presence of a control that writes the whole list.
- The native app does not consult the list in this work. Its recipe screen has no provenance and no notes sections, so only nutrition would be affected, and it is left showing.

### First paint and device preferences

- The mechanism is a cookie, because a cookie is the only device state the server can read while it produces the HTML. Anything read after hydration forces the server to guess a default, and the guess is the flicker.
- One shared device-preference helper replaces the library view switch's bespoke cookie code and is what tickets 17 through 19 consume. It owns the whole shape a preference cookie needs: a parse that always lands on a valid value, the client read and write, the server-side read for seeding the first render, and a provider that seeds from the server pass, reads the cookie itself when there was no server pass (the offline bootstrap), and reconciles once after mount because the service worker can answer a navigation with cached HTML that predates the last toggle.
- The cookie contract, settled during the ticket breakdown. Names use underscores because the `norish:` colon convention of the localStorage keys cannot ride in a cookie name:

  ```
  norish_recipe_view_mode        "grid" | "list"                   default "grid"
  norish_grocery_view_mode       "store" | "recipe"                default "store"
  norish_grocery_group_similar   "true" | "false"                  default "true"
  norish_todays_meals_visibility "always" | "planned" | "hidden"   default "always"
  norish_amount_display          "fraction" | "decimal"            default "fraction"
  ```

- No fallback reads of the retired localStorage keys and no migration, matching Hidden Items' own no-backfill decision: a reader picks each moved preference once more and it sticks.
- Today's meals visibility stays device-local, exactly as this spec's Out of Scope already fixes. The cookie changes where the device keeps the rule, not who owns it, and the settings select above it is untouched.
- The amount display preference keeps the shared hook's interface, so every consumer is untouched; only the web storage binding underneath changes. Mobile keeps its own native binding.
- The library filters deliberately do not move to a cookie. Their stored shape is a structured set of fields and chips, too large and too changeable to send with every request. The filters context already exposes a hydration signal that nothing consumes; the library consumes it and holds its existing loading presentation until the stored filters are applied. One frame of skeleton beats a frame of wrong recipes.
- The Admin tab derives from the session. The session the server resolves for every page already carries the server-owner and server-admin flags, and the client cannot write those fields. Settings gains a thin server pass that reads the session and hands the role to the page — the same shape the dashboard uses today — the gate stops waiting on any fetch, and the role query that existed only to drive the gate is deleted. Every admin procedure keeps its own server-side authorisation; the tab was never the security boundary and still is not.
- The Hidden Items list is part of what the first render knows, on every load path: the server render reads the reader's preferences while producing the HTML, and the offline shell finds the list in the persisted cache rather than waiting on the network. Whether the seed travels by server pass, by the warm set, or both is the implementer's call; the behaviour is that no consumer of the list ever renders before knowing it.

## Testing Decisions

A good test here asserts what a reader sees, not how the component decided. The existing recipe page tests are the model: they assert "the section is absent when nothing is stored and nothing is running" rather than inspecting a predicate's return value, which is why adding "and absent when the reader has hidden it" belongs in the same place and reads as another reason rather than a new mechanism.

Three seams, two of which already exist.

**The recipe page, at page level.** The entire visible effect of Hidden Items is which sections render, so one page-level suite drives all six entries from a given hidden list, plus the case that matters most: that hiding Recipe Provenance removes the card and leaves the origin flag beside the title. This is higher than testing each card in isolation and it is the level at which the rule is actually a rule. Prior art is the existing mobile recipe page test for whole-page composition, and the existing Recipe Provenance card suite — twelve tests, all about when the section renders and what it says — for the style of assertion.

**The settings preferences card.** The write side. The existing suite already has one test per display switch, timers included; those become tests that the multi-select writes the right list and reflects what is stored, plus the carried rule — a gated-off or unrecognised stored entry survives a write untouched. Nothing new is created, and the language and today's-meals tests around them should continue to pass untouched, which is the evidence that only the display toggles were absorbed. The administrator capability's own tests stay where they are.

**A design-invariants suite.** One new test that reads the web app's own source and fails on drift: no blur utilities or `backdrop-filter`, no glass tokens, and no remaining handrolled segmented control. That single file makes ADR-0020 permanent instead of a thing reviewers have to notice, and it proves the Tabs migration finished rather than leaving the old control beside its replacement. Prior art is the existing quality-gates suite, which reads the CI workflow and the root package manifest and fails when the gates stop being able to fail.

Two existing suites change fixtures only, and their passing unchanged is itself the assertion. The filters panel suite covers the rating and favourites filters, whose behaviour is preserved and only re-sourced. The tRPC user router suite covers reading and updating preferences and needs the new key shape.

**First paint, in the browser harness.** The first-paint work adds no seams. Its claim — the HTML the server sends already reflects the stored choice — is only observable at the seam that speaks real HTTP, and the app already has one: the production-like browser E2E harness. The harness asserts the server response for each cookie value: a groceries request carrying the recipe view arrives recipe-grouped, a dashboard request carrying hidden arrives without the Today block, a recipe request carrying decimals arrives with decimal amounts, and a settings request from an administrator arrives with the Admin tab in the first markup while a member's arrives without it and without any role request on the wire. The offline side of the same harness covers the two paths that bypass the server: a navigation answered by the service worker's cached HTML settles on the cookie's current value, and the offline bootstrap applies the persisted hidden list and the cookies without the network. The shared preference helper's parse fallback and read/write round trip get plain unit tests, and the write side of each preference stays where it already lives — the settings suite and the groceries and library suites. "Not one frame" is not screenshot-diffed; asserting the server-sent markup, and that no post-hydration swap follows, is the testable form of the same promise.

Deliberately not covered by automated tests: the token warming, the chip restyle, the bottom bar, the sign-in treatment and the sign-in hand-off. They are visual, they have no coverage today, and screenshot tests would pin down exactly the pixels most likely to keep moving. These are verified by hand on the dev server, in both themes, on a phone viewport and a desktop one.

## Out of Scope

- The documentation site's theme. It hand-ports the token values, sits outside the workspace, and is knowingly left on the cool ground.
- The quick-import extension's HeroUI version. It stays on its pinned beta.
- The native app honouring Hidden Items. Its recipe screen has no provenance or notes sections, and its nutrition section keeps showing.
- The native app's glass. Platform blur there is a real effect and ADR-0020 is scoped to the web.
- The roughly fifty non-auth places that report errors as a bare red sentence. Only the auth pages move to alerts.
- Field-level validation presentation anywhere.
- Today's-meals visibility. It stays a device-local three-state select and does not join the hidden list.
- The administrator's deployment-wide timers capability. Hiding timers is the reader's own Hidden Item; whether timers exist at all for the deployment stays the administrator's setting, untouched here.
- Cooking mode's tabs. Already on the library component and untouched.
- Any change to what Recipe Enrichment produces, when it runs, or what the recipe editor can set.
- A two-column sign-in layout, and the landing's large scroll-driven scenes. Only the small ingredient drawings are ported.
- The mobile app's amount display storage and behaviour. Only the web binding under the shared hook changes.
- Migration reads of the retired localStorage keys. A reader re-picks each moved preference once, the same stance Hidden Items takes on its display booleans.
- Moving the library filters into a cookie. They stay device-stored and gate on hydration instead.
- A live mid-session role change moving the Admin tab in or out without a navigation. The next server render reflects it.

## Further Notes

The glossary gains **Hidden Item** in the recipes section, defining it as something a reader has chosen not to be shown, suppressed everywhere it would appear for them, settling nothing about the recipe. It names the origin flag as chrome rather than Recipe Provenance, so the flag surviving is a consequence of the definition. **Nutrition Information** stands unchanged and "Macros" stays on its avoid list.

ADR-0020 records the glass removal. It exists because the narrower rule — keep blur where something real is behind it — is the obvious reading and is exactly the concession that produced the current state, so a future reader finding no blur over photos would otherwise assume an oversight and re-add it.

Two things are worth watching during implementation. First, moving the account avatar into the bottom bar changes what its menu anchors to, and this app has known rules about popovers inside panels and about menus that re-render mid-exit; the menu's positioning and focus behaviour need checking rather than assuming. Second, the HeroUI upgrade touches most of the library's component stylesheets while this app hand-overrides several of them, so the overrides should be re-checked as part of the upgrade rather than discovered later.

The work is one pull request in ordered commits: tokens first, since everything else reads them; then the library upgrade and the Tabs migration; then the glass removal and the bottom bar; then the sign-in page; then Hidden Items. Chips fall out of the token commit and the chip rule commit together.

The first-paint work is tickets 16 through 22 in this directory and follows the same ordered-commit shape: the shared device-preference helper first (16), since its three consumers read it; then groceries, Today's meals and amounts (17, 18, 19); the Admin tab (20) and the filters gate (21) stand free and can land at any point; the Hidden Items seed (22) follows Hidden Items itself (04). The library view switch is touched twice on purpose — ticket 06 rebuilds its control on Tabs while ticket 16 re-homes its storage — and both leave its behaviour identical, so their order does not matter.
