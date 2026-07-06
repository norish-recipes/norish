## 1. Foundation

- [x] 1.1 Add and validate the mobile drag-and-drop dependency needed for grocery row reordering on iOS.
- [x] 1.2 Define local mock grocery, store, and recipe view models plus dummy data fixtures for the mobile groceries route.
- [x] 1.3 Create the mobile groceries module structure so route, sections, rows, and drag helpers stay isolated from future data wiring.

## 2. Screen Shell And Mode Switching

- [x] 2.1 Replace the placeholder `apps/mobile/src/app/(tabs)/groceries/index.tsx` screen with an iOS-first groceries screen shell.
- [x] 2.2 Implement visible grouping controls for switching between store and recipe modes using `heroui-native` and/or Expo UI primitives.
- [x] 2.3 Add native-feeling header, summary, and section chrome that preserves readability while using Liquid Glass-friendly surfaces selectively.

## 3. Store And Recipe Presentations

- [x] 3.1 Implement store mode with separate unsorted and per-store sections backed by mock data.
- [x] 3.2 Implement recipe mode with per-recipe sections plus a fallback section for groceries without recipe associations.
- [x] 3.3 Build reusable grocery row components with touch-sized layout, metadata, and drag affordances that work in both modes.

## 4. Drag And Drop Behavior

- [ ] 4.1 Integrate `react-native-reanimated-dnd` for in-section grocery reordering with live drag feedback.
- [ ] 4.2 Support moving groceries between supported sections and update local mock state after drop.
- [ ] 4.3 Keep drag state and list mutation logic behind local handlers so real hooks/contexts can replace them later.

## 5. Integration Readiness

- [ ] 5.1 Add placeholder add-item and item-action entry points without wiring shared grocery hooks, mutations, or sheets.
- [ ] 5.2 Verify the groceries route remains iOS-focused, readable, and consistent with existing mobile navigation behavior.
- [ ] 5.3 Run the relevant mobile lint, typecheck, and test or app verification commands needed to confirm the UI-only implementation is stable.
