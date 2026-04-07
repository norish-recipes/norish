## Context

The app's primary screen is the Recipes tab (`apps/mobile/src/app/(tabs)/recipes.tsx`), which renders a flat `ScrollView` of swipeable recipe cards from static mock data. It has no time-aware context and no sectioning — every recipe has equal weight regardless of whether it's planned for today or never cooked. The shell header cogwheel button uses `rgba(255,255,255,0.08)` as its iOS background, which is essentially invisible against the app's light mode background (oklch 97% — near-white). On dark mode the near-transparent white reads fine; on light mode it does not.

This change is purely a **mobile mockup** — no backend calls, no persistence, no real planning logic. All data is static mock data wired for visual demonstration.

## Goals / Non-Goals

**Goals:**

- Restructure the recipes tab into a vertically scrollable dashboard with named sections
- Add a "Today's Meals" section at the top with Breakfast / Lunch / Dinner slots linking to recipes
- Add a "Continue Cooking" horizontal scroll row surfacing recently-touched recipes
- Add a "Discover" horizontal scroll row for variety browsing
- Keep the existing full recipe list accessible below the dashboard sections ("Your Collection")
- Fix the settings cogwheel to be visible in both light and dark mode

**Non-Goals:**

- Real meal planning logic or calendar integration (that's the Calendar tab's domain)
- Backend API calls or persistence of any kind
- User personalization or preference-based recommendations
- Animations beyond what already exists in the app

## Decisions

### 1. Dashboard sections are co-located in `recipes.tsx`, not a new screen

The tab is already named `recipes` with a file-based route. Rather than introducing a new screen or renaming the route (a breaking navigation change), the dashboard sections are rendered at the top of the same `ScrollView`. The flat recipe list remains at the bottom as "Your Collection". This avoids any route-level changes and keeps the diff minimal.

**Alternatives considered:** A dedicated `home.tsx` tab replacing `recipes` — rejected because it would require renaming the route, updating nav config, and invalidating the existing `index.tsx` redirect. Disproportionate change for a mockup.

### 2. Section components are new files under `apps/mobile/src/components/home/`

Each section (TodaysMeals, ContinueCookingRow, DiscoverRow) is a standalone component file following the existing `components/home/` convention. This keeps `recipes.tsx` readable and makes sections individually testable/replaceable later.

### 3. Today's Meals uses a horizontal meal-slot card row

Three cards (Breakfast / Lunch / Dinner) rendered in a horizontal `ScrollView`. Each slot shows: meal type label, recipe name, course emoji or icon, and a brief subtitle. If no meal is planned for a slot, a "+" add prompt is shown instead. This is mock data — no real planning state.

**Data shape** (mock only, local to the component or a new mock file):

```ts
type PlannedMeal = {
  slot: "Breakfast" | "Lunch" | "Dinner";
  recipeId: string | null; // null = no meal planned
  recipeTitle: string | null;
  imageUrl: string | null;
  totalDurationMinutes: number | null;
};
```

### 4. Continue Cooking and Discover are horizontal `FlatList`/`ScrollView` rows

A `ScrollView` with `horizontal` prop renders a row of compact recipe cards. The existing `MobileRecipeCard` is too tall/wide for this use; a new `CompactRecipeCard` sub-component (or a `size="compact"` prop on the existing card) is introduced. Decision: **new `CompactRecipeCard` component** — avoids adding conditional complexity to `MobileRecipeCard`.

**Alternatives considered:** `size` prop on existing card — rejected because the rendering logic diverges significantly (square crop vs 16:9, no swipe actions, different info density).

### 5. Cogwheel fix: replace static rgba with `useThemeColor` surface token

The `glassWrap` border and `settingsButtonIos` background both use hardcoded `rgba(255,255,255,...)` values that only work on dark backgrounds. The fix uses `useThemeColor(['separator', 'surface'])` and conditionally adjusts opacity, or switches to a fully opaque `surface` token so that it creates contrast in both modes.

Specifically:

- `settingsButtonIos` background: `rgba(127,127,127,0.15)` — neutral grey works on both light and dark backgrounds
- `glassWrap` border: `rgba(0,0,0,0.12)` in light mode, `rgba(255,255,255,0.25)` in dark mode — driven by resolved theme
- The `BlurView` tint already switches between `systemChromeMaterialDark` and `systemChromeMaterialLight`, which is correct; only the container background/border needs updating

**Alternatives considered:** Switching to a flat non-blur button on both platforms — rejected because the blur is a deliberate native design choice for iOS and should be preserved where it works.

### 6. Section headers follow existing `ShellHeader` typography hierarchy

Section titles (e.g., "Today", "Continue Cooking", "Discover") use the same font scale as existing `heading`/`subheading` styles in `index.styles.ts` to maintain visual consistency. No new design tokens introduced.

## Risks / Trade-offs

- **Horizontal scroll nesting** → React Native's `ScrollView` + nested horizontal `ScrollView` is standard practice but can cause gesture conflicts on Android. Mitigation: use `nestedScrollEnabled` on inner horizontal lists, and test on Android emulator.
- **Mock data coupling** → Dashboard sections reference recipe IDs from `recipe-mock-data.ts` by value. If mock data changes, planned meal slots may reference stale IDs. Mitigation: acceptable for a mockup; document that IDs are hardcoded for demo purposes.
- **`recipes.tsx` grows in length** → Adding three section components inline could make the screen file long. Mitigation: each section is a separate component file, keeping `recipes.tsx` as a thin orchestrator.
- **Cogwheel blur on light mode** → Even after the fix, the `BlurView` with `systemChromeMaterialLight` tint may appear almost transparent depending on the wallpaper/content behind it. Mitigation: the `surface` background behind the blur provides a visible fallback floor.
