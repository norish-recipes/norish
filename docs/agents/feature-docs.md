# Feature Docs & Release Notes

Definition of done for user-visible work: a feature lands together with its release-notes section and its documentation, in the same PR as the feature (separate commits are fine).

## What every feature ships with

1. **A release-notes section.** Add a short entry to the Target Version's page, `apps/docs/docs/release-notes/<target>.md` — a `###` under `## Features`, or a bullet under `## Fixes and Improvements`, as fits. Write for users and self-hosting operators in plain product language (use the glossary's vocabulary); internal-only work (refactors, test tooling, ADR records) is deliberately unpublished (ADR-0010).

2. **Documentation with screenshots.** Create or update the relevant page(s) under `apps/docs/docs/` showing how the feature works. Screenshots live in `apps/docs/static/img/screenshots/` and are embedded as `![…](/img/screenshots/<file>.png)`. A feature isn't documented until a reader can see it working.

3. **Env variables.** If the feature adds, changes, or removes an environment variable:
   - update `.env.example` at the repo root,
   - document it on the matching `apps/docs/docs/configuration/` page (admin-settings, ai-provider, authentication, database, localization, parser, server-runtime — add a page if none fits),
   - call it out in the release notes under `## Upgrade notes` — self-hosters read these before upgrading.

## Checkpoint and Target Version

The editable docs (`apps/docs/docs/`) always carry the Target Version's label (`current.label` in `docusaurus.config.ts` — never hand-edit it; the script owns it).

- **Checkpoint and target release notes already exist** — a frozen snapshot of the previous version under `apps/docs/versioned_docs/` and an editable `release-notes/<target>.md` — then just update them. This is the normal case (as of July 2026: `0.19.1-beta` is frozen, `0.20.0-beta` is the editable Target Version).
- **They don't exist yet** — the previous release's docs are still the editable ones because no checkpoint has run since it shipped — then make the checkpoint first: run `pnpm docs_update <target>` in `apps/docs` (freezes the outgoing version exactly once and advances the editable label), create `release-notes/<target>.md` in the established structure (`Summary`, `Features`, `Fixes and Improvements`, `Upgrade notes`, `Contributors`), then add your section. ADR-0010 documents the command's scope and the checkpoint mechanics.

Validation is unchanged from ADR-0010: the docs format check (`pnpm format` in `apps/docs`) and a production build (`pnpm build`, which enforces broken links and anchors) must pass. Note `apps/docs` is a standalone pnpm workspace — run these inside that directory.

## Catch-up posture

Documentation coverage is behind the product — known debt, being paid down by ratchet, not by big-bang:

- **New features document themselves fully.** No new undocumented surface, ever.
- **Touch it, document it.** If a change materially alters an undocumented area, document that area as part of the change — opportunistic backfill, scoped to what was touched.
- **Never block a feature on unrelated backfill**, and don't attempt whole-app documentation sweeps inside a feature PR.

## Relation to ADR-0010

ADR-0010 established the Release Checkpoint and the one-command docs transition, with notes drafted retrospectively from the checkpoint. This convention extends it: notes now accrue per feature during the cycle, and the release-time job shrinks to a final sweep — verify completeness against the commit range, record provenance, freeze. The command, page structure, and out-of-scope list in ADR-0010 remain authoritative.
