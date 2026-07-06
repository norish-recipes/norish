## Context

The mobile groceries route currently renders a generic placeholder screen, while the web app already supports the two core grocery organization modes the product needs: by store and by recipe. The requested change is intentionally UI-first: it should establish an iOS-native grocery experience in `apps/mobile` using mock data only, preserve room for later hook/context wiring, and lean on `heroui-native` plus Expo UI surfaces instead of custom visual primitives.

This work also introduces drag-and-drop as part of the first visible mobile groceries experience. Because drag interactions affect layout structure, grouping containers, and item composition, the implementation needs a documented component hierarchy before real data integration begins.

## Goals / Non-Goals

**Goals:**
- Replace the placeholder groceries tab with an iOS-first screen that feels native.
- Support the same two top-level grouping modes as web: store and recipe.
- Define drag-and-drop behavior for grocery rows and grouped containers using `react-native-reanimated-dnd`.
- Prefer `heroui-native` and Expo UI building blocks, including Liquid Glass-friendly presentation where it improves the iOS feel.
- Keep data access abstracted behind local mock models so later shared hooks/contexts can replace the mock source with minimal UI churn.

**Non-Goals:**
- Wiring shared grocery hooks, subscriptions, mutations, or offline sync.
- Matching web styling one-for-one.
- Finalizing add/edit/delete grocery flows beyond placeholder entry points.
- Supporting Android-specific layout or interaction behavior in this change.

## Decisions

### Use a presentation-first mobile grocery module with mock adapters

The screen will be built around mobile-local view models and dummy data factories instead of importing unfinished grocery state directly. This keeps the UI implementation shippable for design review now and avoids coupling to unstable data contracts.

Alternative considered: wire shared grocery hooks immediately. Rejected because the user explicitly wants the UI/UX phase first and existing hooks/contexts should not drive current implementation scope.

### Preserve web information architecture but not web component structure

The mobile experience will mirror web at the product level: users can switch between store-grouped and recipe-grouped grocery organization, see grouped sections, and drag items within those sections. The component structure will be redesigned for mobile scanning, larger touch targets, and iOS navigation patterns rather than porting web list containers directly.

Alternative considered: reuse web grouping/presentation concepts wholesale. Rejected because the web hierarchy is optimized for desktop density and dropdown-driven controls, not iOS-native navigation and gestures.

### Use segmented controls and native-feeling surfaces for mode switching and chrome

The groceries screen should expose grouping mode with an always-visible, low-friction control near the top of the screen, backed by iOS-style segmented UI. Section chrome, summary chips, and utility actions should use HeroUI Native primitives and Expo UI surfaces to create depth and translucency without bespoke styling systems.

Alternative considered: keep controls in a menu similar to web. Rejected because mode switching is a primary mobile task and should be discoverable without extra taps.

### Adopt `react-native-reanimated-dnd` for sortable rows and cross-container moves

The drag system will be isolated behind mobile grocery list components so row rendering and drop behavior stay local to the groceries module. Initial scope covers visible drag affordances, reorder feedback, and movement between supported sections using mock state updates.

Alternative considered: defer drag-and-drop until after data wiring. Rejected because drag behavior materially affects row anatomy, spacing, gestures, and section composition.

### Keep extension points for future real data and action sheets

Component props and local state should distinguish presentation state, grouping state, and mutation handlers so later implementation can replace mock callbacks with shared hooks, sheets, and optimistic updates. The initial UI may expose placeholder controls for add/item actions, but those should remain clearly isolated from core list rendering.

Alternative considered: embed local action logic directly inside row components. Rejected because it would make later integration with shared contexts and native sheets harder.

## Risks / Trade-offs

- [Mock data diverges from backend DTO shape] -> Keep mobile view models close to current grocery/store/recipe naming and avoid unnecessary transformation layers.
- [Drag-and-drop library constraints force layout compromises] -> Validate section/container structure early with a small vertical slice before polishing the rest of the screen.
- [Liquid Glass styling reduces readability over complex content] -> Limit translucent treatment to headers, controls, and section chrome while keeping grocery rows high-contrast.
- [UI-first work creates throwaway code] -> Separate mock data providers from presentational components so real data wiring replaces only the source layer.
- [Store and recipe modes become too different to maintain] -> Reuse shared row primitives and section metadata patterns even if container composition differs by mode.

## Migration Plan

1. Replace the placeholder groceries route with the mock-data experience behind the existing tab route.
2. Add the drag-and-drop dependency and validate it on iOS simulators before broad UI polish.
3. Build mobile grocery components so a later follow-up can swap mock adapters for shared hooks/context wiring without reworking the screen architecture.
4. Keep rollback simple by containing the change to the mobile groceries route and related local components.

## Open Questions

- Whether drag-and-drop in recipe-grouped mode should move items only within a recipe group in the first pass or also support cross-group reassignment in the mock implementation.
- Which Expo UI components provide the best fit for the intended Liquid Glass treatment once implementation begins.
- Whether grouped-ingredient behavior from web should remain out of scope for the first mobile UI pass or be introduced as a later enhancement.
