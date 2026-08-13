# 02 — HeroUI moves to 3.2.4 through the workspace catalog

**What to build:** The web app runs on HeroUI 3.2.4, and the version is declared in exactly one place. The workspace catalog currently names a version nothing uses while the web app pins its own literal; after this the catalog is the single declaration and the web app consumes it. Everything that looked right before still looks right, because the upgrade rewrites most of the library's component stylesheets and this app hand-overrides several of them.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] The catalog declares 3.2.4 for both HeroUI packages, and the web app consumes the catalog entry rather than its own version literal.
- [x] The quick-import extension is untouched and stays on its pinned beta; it sits outside the workspace and is not part of this work.
- [x] The app builds, and the repo's gates pass.
- [x] The hand-written overrides for chips, dropdown popovers, menu items and form controls are re-checked against the new stylesheets and still do what they were written to do. Roughly two thirds of the library's component stylesheets changed between the two versions, including every one those overrides touch.
- [x] Tabs render correctly in settings and in cooking mode, both of which already use the component.
- [x] Forms, menus, modals, panels and the calendar are walked through by hand in both themes and nothing has visibly regressed.

## Comments

- Shipped in 6c849d7e. The workspace catalog declares 3.2.4 for both HeroUI packages, the web app consumes the `catalog:` entry instead of its own literal, the lockfile resolves `@heroui/*@3.2.4`, and the quick-import extension stays on its pinned `3.0.0-beta.6`. All four gates run green on this branch (lint, i18n:check, test:run, build — 2026-08-13). The both-theme walkthrough of forms, menus, modals, panels and the calendar is by hand per the spec's testing decisions.
