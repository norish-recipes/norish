## Context

The mobile experience currently lacks a dedicated, recipe-first home feed, while the web app already presents recipes in a grid-based dashboard (`apps/web/components/dashboard/recipe-grid.tsx`). This change introduces a native-oriented list of recipe cards for mobile using mock data in the first iteration. The design must preserve the web information hierarchy (image + key metadata) while adapting for touch ergonomics, vertical scrolling, and compact card readability.

## Goals / Non-Goals

**Goals:**

- Deliver a mobile home screen that renders a performant vertical list of recipe cards.
- Surface required recipe attributes on each card: image, title, two-line description, servings, rating, tags, course, liked state, and total duration.
- Use deterministic mock data so UI can be built and tested without backend coupling.
- Align visual structure with existing web dashboard patterns without copying desktop layout assumptions.

**Non-Goals:**

- Implement backend integration, pagination APIs, or personalized ranking.
- Introduce recipe editing flows from the home list.
- Finalize long-term data contracts for ratings/tags beyond what the mock model requires.

## Decisions

- Use a dedicated mobile home list component composed from existing mobile UI primitives and icons.
  - Rationale: keeps implementation localized, minimizes cross-surface regressions, and supports future replacement of mock data with fetched data.
  - Alternative considered: reusing web card components directly; rejected because web components are layout- and platform-assumption heavy.
- Prefer HeroUI Native components and Uniwind/Tailwind utility classes for layout and presentation; keep custom styling minimal and only where no suitable component or utility exists.
  - Rationale: aligns with project conventions, improves consistency, and reduces maintenance cost from bespoke styles.
  - Alternative considered: building fully custom-styled cards from base primitives; rejected because it reinvents existing design-system patterns.
- Represent list items with a strict view model (`MobileRecipeCardItem`) that contains all required display fields.
  - Rationale: separates rendering from source data and enables straightforward migration from mock data to API response mapping.
  - Alternative considered: passing raw recipe entities into UI; rejected due to higher coupling and brittle rendering assumptions.
- Clamp description to two lines and prioritize metadata grouping by scan value (title/description first, utility metrics second).
  - Rationale: improves glanceability and avoids uncontrolled card growth on small screens.
  - Alternative considered: full description expansion; rejected because it degrades list density.
- Use course and tags as compact chips/badges with conservative wrapping rules.
  - Rationale: maintains modern native look while preserving metadata discoverability.
  - Alternative considered: plain comma-separated text; rejected for lower readability and weaker visual hierarchy.

## Risks / Trade-offs

- [Risk] Mock data shape may diverge from eventual API fields -> Mitigation: isolate mapping layer and keep UI bound to view model, not backend schema.
- [Risk] Metadata-heavy cards can become visually crowded on narrow devices -> Mitigation: enforce two-line description clamp, compact icon+text rows, and tag overflow handling.
- [Risk] Large image assets may hurt scroll performance -> Mitigation: use optimized image sizing and avoid unnecessary re-renders via stable mock dataset and keyed list items.
- [Trade-off] Building a mobile-specific card instead of shared cross-platform card increases component count -> Mitigation: keep shared field model and styling tokens to reduce maintenance overhead.
