## Context

The mobile app currently mixes product code (home recipe cards) with Expo starter-template code paths (`explore` route, starter tab labels, documentation links, themed helper wrappers, and splash/demo animation pieces). These starter artifacts increase coupling between active screens and template abstractions, which makes future feature work harder and leaves dead code paths in navigation.

The target state is a lean app shell that keeps active product surfaces running while removing template-specific routes/components/hooks/theme tokens that are no longer needed.

## Goals / Non-Goals

**Goals:**

- Remove starter-only route and navigation references (`explore`, docs links, starter branding).
- Remove template-only shared UI/theme/hook files when they are not required by current product screens.
- Preserve currently active mobile functionality (home feed rendering, swipe actions, providers/safe-area setup).
- Leave the mobile app in a compile-ready state with no imports pointing to deleted starter files.

**Non-Goals:**

- Redesigning the home recipe card feature or changing its product behavior.
- Introducing backend integration changes or API contract changes.
- Performing broad visual restyling beyond what is needed to remove starter dependencies.

## Decisions

1. **Route and tab simplification first**
   - Remove `src/app/explore.tsx` and update tab/shell code so only product-relevant routes remain.
   - Rationale: Navigation references create hard dependencies on template screens; removing them early avoids dangling imports and lets cleanup be verified incrementally.
   - Alternative considered: Keep `explore` as placeholder route. Rejected because it preserves template coupling and does not satisfy the cleanup intent.

2. **Dependency-driven component cleanup**
   - Build a usage inventory from route entry points (`src/app/_layout.tsx`, `src/app/index.tsx`) and remove helper files that become unused (`external-link`, `web-badge`, `ui/collapsible`, starter animation bits, themed wrappers if replaced).
   - Rationale: Prevents accidental deletion of still-required files while ensuring dead starter pieces are fully removed.
   - Alternative considered: Delete the whole `src/components` and `src/hooks` folders wholesale. Rejected because active screens still depend on some shared code and would require unnecessary rework.

3. **Promote direct styling primitives where starter wrappers were only indirection**
   - Where feasible, replace `ThemedText`/`ThemedView` and `useTheme` indirection with direct React Native/HeroUI/Tailwind usage already used by product surfaces.
   - Rationale: Starter wrappers encode demo-specific typography/theme decisions and hide simple styling behavior.
   - Alternative considered: Keep wrappers and only remove explore screen. Rejected because it leaves most template code in place and limits the cleanup value.

4. **Guard cleanup with local validation**
   - Run lint/typecheck (or the mobile app's equivalent validation command) after cleanup to ensure route resolution, imports, and removed files are consistent.
   - Rationale: File-based routing and platform-specific component files can fail silently if only manually inspected.

## Risks / Trade-offs

- [Risk] Removing shared wrappers may cause broader style regressions on home surfaces. -> Mitigation: migrate one screen at a time and validate key text/background styles before deleting wrappers.
- [Risk] Deleting route files can leave stale tab references on native/web variants. -> Mitigation: update both `app-tabs.tsx` and `app-tabs.web.tsx` in the same change and run route build checks.
- [Risk] Some "starter" files may still provide useful behavior (e.g., splash overlay). -> Mitigation: keep explicitly retained pieces only when referenced by active product entry points, and document retained exceptions in implementation notes.
- [Trade-off] Fast cleanup may keep small utility remnants temporarily. -> Mitigation: include a final unused-file/import sweep task before closing the change.
