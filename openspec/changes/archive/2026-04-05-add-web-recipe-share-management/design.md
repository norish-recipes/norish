## Context

The web recipe detail context already exposes recipe-share state and mutations through `sharedRecipeShareHooks`, and the backend can already create, revoke, delete, and resolve public recipe shares. What is still missing is the web product surface: the recipe page does not expose sharing at all, `/share/[token]` has media routes but no page, and the user/admin settings areas do not yet show share-link inventories.

Route structure matters for the public page. `apps/web/app/(app)/layout.tsx` mounts `AuthProviders`, user/household/permissions/recipes contexts, the navbar, and `TimerDock`, which is appropriate for authenticated app screens but not for an anonymous shared recipe page. The public share route already sits outside `(app)` in the filesystem, and this change should preserve that separation rather than trying to reuse the authenticated app shell.

The explored codebase suggests a clear implementation direction. Recipe detail actions already launch recipe-scoped panels from `actions-menu.tsx`, user settings already use `Card + Table + confirm modal` patterns in `api-token-card.tsx`, and admin settings already stack feature cards under `admin-settings-content.tsx`. The public recipe DTO is also intentionally readonly and smaller than the authenticated recipe shape, so the public page cannot simply mount the existing authenticated recipe detail context unchanged.

The current `apps/web` test baseline is also noisy: `pnpm --filter @norish/web run test:run` currently reports 14 failing tests across five files, mostly around shared subscription test harness drift. This change therefore needs both feature planning and a stabilization track so new regressions are attributable.

## Goals / Non-Goals

**Goals:**

- Add a recipe-page share management entry point that opens a bottom panel for create/list/copy/revoke/reactivate/delete flows.
- Add user-settings and admin-settings inventory views for recipe share links that match established web card/table/action patterns.
- Deliver a readonly public share page at `/share/[token]` that reuses extracted recipe detail presentation components instead of duplicating or creating one monolithic page.
- Keep the public share route outside the authenticated `(app)` route group and avoid mounting the authenticated app shell or its realtime-heavy providers there.
- Keep all new text in `next-intl`, reusing existing `common.actions` and recipe/settings strings wherever possible.
- Capture the pre-existing failing web unit-test baseline and sequence remediation work so implementation can land on a cleaner baseline.
- Include the small desktop recipe hero radius fix in the same workstream because it lives in the same recipe-detail surface.

**Non-Goals:**

- Reworking the mobile app share flow.
- Redesigning recipe sharing permissions beyond the already established edit-access model.
- Adding SEO metadata, social previews, analytics, or public indexing behavior for shared recipe pages.
- Rebuilding the authenticated recipe detail page from scratch; the goal is extraction and reuse, not a layout redesign.

## Decisions

1. Use the existing recipe actions menu and `Panel` component for recipe-scoped share management.
   - Decision: add a new share action to `apps/web/app/(app)/recipes/[id]/components/actions-menu.tsx` that opens a bottom sheet built on the existing `Panel` component.
   - Rationale: recipe actions already launch contextual recipe tools from this menu, and `Panel` matches the requested bottom-panel behavior without introducing a second interaction model.
   - Alternative considered: a centered modal or a dedicated share subpage. Rejected because the rest of the recipe-detail UX already favors inline recipe-scoped overlays.

2. Model the panel as a share-management workspace, not a one-shot create dialog.
   - Decision: the panel should show both a creation affordance and the current per-recipe share list in the same surface, with row actions for revoke, reactivate, and permanent delete.
   - Rationale: the user explicitly wants to create links and inspect existing ones in one place, and the existing share query in recipe detail context already provides the per-recipe dataset.
   - Alternative considered: separate create and manage panels. Rejected because it adds navigation overhead and duplicates state refresh logic.

3. Add minimal backend follow-ups where the current share contracts are insufficient for the requested web surfaces.
   - Decision: extend the share lifecycle/API surface with a reactivation operation and add actor-wide/admin-wide list procedures or query shapes that can power settings tables without faking those views client-side.
   - Rationale: the current router only exposes per-recipe owner lists, plus create/update/revoke/delete. Reactivation, current-user inventory, and instance-wide admin inventory are not all available from the existing web-consumable contract.
   - Alternative considered: limit the web work to per-recipe management only. Rejected because it would not satisfy the settings/admin requirements in the request.

4. Build the public share page from extracted presentational recipe-detail blocks instead of reusing the authenticated recipe detail context wholesale.
   - Decision: extract or wrap readonly summary, ingredients, notes, steps, and nutrition/media building blocks so both authenticated recipe detail and `/share/[token]` can compose them.
   - Rationale: current page files embed favorites, ratings, add-to-groceries, actions, and recipe-context assumptions that do not exist for `PublicRecipeViewDTO`. Minimal extraction preserves visual consistency while avoiding a monolithic public page file.
   - Alternative considered: duplicate the desktop/mobile recipe page markup inside `/share/[token]`. Rejected because it would make the two surfaces drift immediately.

5. Keep `/share/[token]` outside `(app)` and give it only the providers it actually needs.
   - Decision: implement the shared recipe page under `apps/web/app/share/[token]` with a lightweight share-specific layout or provider wrapper if needed for HeroUI and tRPC, but do not route it through `(app)/layout.tsx`.
   - Rationale: the authenticated app shell brings navbar chrome, auth/session wiring, recipe/user/household contexts, timer UI, and websocket-oriented provider setup that are inappropriate for a public anonymous page.
   - Alternative considered: placing the page under `(app)` to reuse the existing shell. Rejected because it would leak authenticated app behavior and unnecessary client state into a public route.

6. Keep desktop and mobile shared-page layouts visually aligned with the current recipe detail page, but explicitly remove authenticated-only controls.
   - Decision: the shared page should keep the same two-column desktop structure and hero-plus-rounded-card mobile structure, while omitting the back button, actions menu, favorite/rating controls, grocery actions, and AI/edit affordances.
   - Rationale: this matches the user's request for an identical readonly page while keeping the anonymous surface clearly constrained.
   - Alternative considered: a brand-new public landing layout. Rejected because it would create unnecessary design divergence.

7. Reuse existing settings card and table conventions rather than inventing new management widgets.
   - Decision: user and admin share inventories should use HeroUI `Card`, `Table`, `Chip`, icon-only row actions, and confirm modals following the existing `api-token-card.tsx` and admin provider action patterns.
   - Rationale: these settings surfaces are already card-stacked and table-driven, and the share lifecycle maps closely to the existing enable/disable/delete semantics.
   - Alternative considered: custom grid or virtualized list UI. Rejected as unnecessary for the current scope.

8. Treat i18n reuse as a design constraint, not cleanup work after the UI is built.
   - Decision: new share-specific namespaces should be small and focused, with shared action labels and generic error text pulled from existing `common.actions` and `common.errors` keys wherever the wording matches.
   - Rationale: the user explicitly asked for i18n discipline and reuse of existing strings, and the repo already follows namespace-per-surface patterns.
   - Alternative considered: add a single large share namespace for every button and message. Rejected because it would duplicate common wording already present elsewhere.

9. Carry a dedicated stabilization workstream in the implementation plan before feature verification is considered complete.
   - Decision: tasks should capture the current failing web baseline, then prioritize subscription-test contract fixes and any harness drift that blocks confident verification of the share work.
   - Rationale: the current 14 failing tests predate the planned UI change; if left untreated, they will obscure whether share-link work is actually correct.
   - Alternative considered: defer all failing tests as unrelated debt. Rejected because the user explicitly asked for a baseline and fix plan.

10. Fix the desktop media radius as a small recipe-detail visual correction within this change.

- Decision: address the missing bottom radius at the hero/media container level while extracting shared page components so desktop recipe and shared layouts do not diverge.
- Rationale: the issue is localized to the same recipe-detail composition work and is inexpensive to correct while touching the hero structure.
- Alternative considered: plan it separately. Rejected because it is part of the same surface and would create unnecessary follow-up churn.

## Risks / Trade-offs

- [The request assumes the backend is mostly ready, but current web-consumable contracts still lack reactivation and broad inventory queries] -> Mitigation: make those additions explicit in the implementation tasks and keep them minimal and scoped to the web requirements.
- [Readonly shared-page extraction could accidentally destabilize the authenticated recipe page] -> Mitigation: extract only presentational blocks first, keep authenticated controls in the existing wrappers, and add focused recipe page/share page tests around the extracted components.
- [The public route could accidentally inherit the authenticated app shell or websocket-heavy providers during implementation] -> Mitigation: keep `/share/[token]` under its existing non-`(app)` route path and add an explicit lightweight layout/provider boundary if client hooks need shared infra.
- [Admin and user inventory tables may need extra metadata such as recipe title or owner identity not currently present in summary DTOs] -> Mitigation: define the missing display fields up front in the spec and avoid overloading the current per-recipe summary shape.
- [The existing failing test baseline can mask new regressions] -> Mitigation: capture the baseline at the start of implementation and treat stabilization as a tracked workstream with explicit verification gates.
- [Public shared pages can drift stylistically from authenticated recipe pages after extraction] -> Mitigation: share the same presentational section components and keep layout differences limited to omission of authenticated-only controls.

## Migration Plan

1. Extend any missing share contracts needed for reactivation and actor/admin inventories.
2. Add the reusable share-management UI pieces for recipe detail, user settings, and admin settings.
3. Extract readonly recipe presentation sections from the authenticated recipe page into reusable components.
4. Add a lightweight share-route layout/provider boundary outside `(app)` if the public page needs HeroUI or tRPC client providers.
5. Implement `/share/[token]` using the shared recipe query and the extracted presentational components.
6. Add or update i18n keys, then correct the desktop hero radius while the shared layout code is in flight.
7. Capture the current failing web test baseline, fix pre-existing blockers in the identified suites, and then add targeted coverage for the new share workflows.

Rollback strategy:

- Hide the recipe/settings/admin share UI entry points and remove the `/share/[token]` page while keeping the already-additive backend share model intact.
- Because the main work is UI and contract extension, rollback can be performed by reverting the web surfaces and any newly introduced share endpoints without touching existing recipe data.

## Open Questions

- None blocking. The current request is specific enough to plan against the existing settings-admin surface and the already separate `/share/[token]` route path.
