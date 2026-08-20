# Recipe Archive export

Status: resolved

Spec for the Recipe Archive export feature. Vocabulary per `CONTEXT.md` (Recipe Archive, Cuisine, Tag, Recipe Enrichment); decisions per ADR-0022 (Recipe Archives are portability, not backup), constrained by ADR-0012 (Cuisines are curated) and ADR-0018 (automatic provenance fills the group's gaps).

## Problem Statement

Recipes go into Norish through five import formats, but nothing comes out. A user who wants to move to a fresh instance, keep an off-instance copy of their collection, or hand their recipes to a friend has no way to do it — their recipes are locked inside the database of one deployment. An administrator has no way to take a content snapshot of everything the instance holds. The closest existing affordance, the public share link, exposes one recipe at a time, stays tied to the origin server, and cannot be imported anywhere.

## Solution

A **Recipe Archive**: a portable `.norishrecipes` file a user downloads with one button press, containing every recipe they can see — complete with all media — which Norish's own importer reads back like any other archive format. Exporting is one operation with two doorways: a button in user settings exports everything the user can see under the deployment's view policy, and the same button in the admin area exports every recipe on the instance. The archive is an exchange of recipe content, never a backup: importing it makes the importer the owner of what it creates, attribution travels as display names only, and no account data or PII rides inside, so the file is safe to hand around.

## User Stories

1. As a user, I want to download all recipes I can see as a single archive file, so that my collection is not locked inside one Norish instance.
2. As a user, I want each exported recipe to carry all its data — ingredients, steps, step ingredients, notes, servings, times, Nutrition Information, Recipe Provenance, categories, tags, and cuisine names — so that nothing about a recipe is lost in transit.
3. As a user, I want all images (hero, gallery, and step images) inside the archive, so that recipes look like themselves after reimport instead of showing dead image references.
4. As a user, I want recipe videos and their thumbnails inside the archive, so that "all the recipe data" means all of it.
5. As a user, I want my own rating and favourite mark on each recipe included, so that the marks I made survive a move to another instance.
6. As a user, I want each recipe to carry its author's display name as attribution, so that I still know whose recipe it was even though ownership does not transfer.
7. As a user, I want the archive to contain no emails, avatars, preferences, or account data of anyone, so that I can hand the file to a friend or post it publicly without leaking anything personal.
8. As a user, I want the export to be a single button in my settings, in its own section beside where archive import already lives, so that getting recipes out is as discoverable as putting them in.
9. As a user, I want the download to start immediately and stream, so that I am not waiting for the server to build something before the first byte arrives.
10. As a user, I want the file named with the date and a recognizable `.norishrecipes` extension, so that successive exports do not overwrite each other and I can tell what the file is years later.
11. As a household member, I want recipes my housemates share with me under the view policy included in my export, so that the household collection travels as a whole.
12. As a user, I want orphaned recipes (whose owner was deleted) included when I can see them, so that the export matches exactly what my library shows me.
13. As a user moving to a new instance, I want to feed my archive to the normal import flow and watch the same progress reporting as any other archive, so that migration needs no new skill.
14. As a user importing an archive, I want the recipes it creates to become mine, so that ownership on the target instance is unambiguous.
15. As a user re-importing my own archive into the same instance, I want matching recipes overwritten rather than duplicated, so that a round-trip does not double my library.
16. As a user importing an archive, I want my rating and favourite from the archive applied to whichever recipe wins the match, so that my marks land where the recipe did.
17. As a user importing an archive whose cuisines are unknown to this instance, I want those cuisine names visibly reported as skipped rather than silently vanishing, so that I know what the import chose not to keep.
18. As an administrator, I want imported recipes never to extend my curated Cuisine vocabulary, so that a zip file cannot do what only I (or an explicitly permissive AI strategy) may do.
19. As an administrator, I want an export button in the admin settings that covers every recipe on the instance regardless of view policy, so that I can take a full content snapshot before risky changes or when winding an instance down.
20. As an administrator, I want the admin export to be the same operation and format as the user export, so that there is one archive format in the world, not two.
21. As a non-admin, I must not be able to trigger the instance-wide export, so that admin scope stays server-authorised, not presentation-gated.
22. As a signed-out visitor, I must not be able to reach the export at all, so that the view policy's protection extends to bulk egress.
23. As a self-hosting operator, I want exports to leave no artifact on the server — no temp files, no stored archives, no cleanup job — so that the feature adds no operational surface.
24. As a user on a future Norish version importing an old archive, I want the format to identify itself and its version, so that the importer can adapt instead of guessing.
25. As a user importing an archive from a _newer_ Norish major format than my instance understands, I want a clear refusal, so that a half-understood archive never half-imports.
26. As a user whose import contains a corrupt or unparsable recipe entry, I want the remaining recipes to import anyway with the failure reported per entry, so that one bad file does not sink the archive.

## Implementation Decisions

- **Scope is delegated, not reimplemented.** The export service takes the existing recipe-list viewer context (user, household member ids, server-admin flag) and asks the existing recipe listing/visibility layer for the visible set. Both doorways pass the exporter's own context, admin flag included — the same context `recipes.list` already builds, which the existing policy logic resolves to "everything" for an administrator. An admin's library and an admin's export therefore hold the same recipes from either doorway, and the admin button is discoverability rather than privileged extra data (ADR-0022). No new visibility logic anywhere.
- **The export splits at the format boundary.** A scope-and-load step assembles full recipe records plus media handles; an _archive writer_ turns those into the zip stream. The writer knows nothing about visibility or HTTP; the route knows nothing about the format. This boundary is the primary test seam.
- **Delivery is a streaming HTTP route handler**, not a tRPC procedure (tRPC does not do file responses; the media-serving routes are the precedent). Session-authenticated; the instance-wide variant additionally requires server-admin, checked server-side. Response streams zip entries as they are produced — media is read from disk and streamed through, never buffered whole — with a content-disposition filename of the form `norish-recipes-<date>.norishrecipes`. No server-side artifact ever exists.
- **Container layout**: a plain zip. Root `manifest.json` with `format: "norish-recipes"`, `formatVersion: 1`, export timestamp, exporter block (display name, instance origin), and recipe count. Then one folder per recipe keyed by its recipe id, holding `recipe.json` and that recipe's media in subfolders (gallery images, step images, videos with thumbnails), referenced from `recipe.json` by relative path. Positive format identification is the manifest, not the extension; the extension is for humans and file pickers.
- **`recipe.json` is a superset of the importer's canonical insert shape** (the same shape all five existing parsers produce), with three deviations, all export-only: cuisines are carried as _names_ (instance-local ids are meaningless elsewhere), media fields are relative paths into the archive, and three extra fields ride along — author display name (attribution), exporter's own rating, exporter's favourite flag.
- **Import is parser #6 in the existing archive loop, semantics inherited unchanged.** The archive-format detector gains positive Norish identification via the manifest; a new Norish parser walks the recipe folders and yields the canonical insert shape plus the imported rating, exactly like the other parsers. Match by URL-or-name within household scope, overwrite on match, freshly minted recipe ids otherwise; archive ids are folder keys only and are never reused. Media rehoming reuses the existing archive-media pipeline.
- **Favourite is a small, additive extension of the loop's per-recipe extras**: applied to the winning recipe alongside the already-supported imported rating, for the importing user, and failure to apply it never fails the import (mirroring the rating's existing error posture).
- **Cuisine names resolve case-insensitively against the target instance's vocabulary**: matches attach, misses are dropped and surfaced in the import result's reporting (the loop already reports skips and errors per entry; dropped cuisine names join that reporting). Never created, never demoted to Tags. Recipe Enrichment refills provenance gaps later under the target instance's own rules.
- **Format-version posture**: `formatVersion` is a major. The importer refuses a newer major with a clear error; within a major, unknown fields are ignored (forward-additive evolution).
- **UI**: the export gets its own card in the user settings tab, directly under the archive-import card; the same button component renders in the admin tab's existing General card with instance scope. Just a button with a busy state — the browser's own download UI stays the place a download is managed. All strings localized across every supported locale.
- **The busy state tracks the real transfer.** Where the browser allows it, the export response is handed to the service worker, which answers a hidden frame's navigation with it: the archive still streams to disk without ever being collected in memory, but the page sees the bytes go past, so the button stays busy for exactly as long as the download runs and counts up what has arrived. There is no percentage — a streamed archive has no declared length. Where there is no worker to hand to, a probe (`?probe=1`) answers the route's authorisation question without building anything and the browser takes the download, leaving the busy state as a double-press guard. Either way an expired session or a refused scope is reported in place, never by navigating the app away to a plain-text error page.
- **Imported recipes follow the same downstream behavior as every other archive import** — same events, same Automatic Recipe Enrichment enrollment posture. No Norish-format special cases anywhere in the pipeline.

## Testing Decisions

- **What makes a good test here**: assert external behavior at the format boundary — records in, archive out; archive in, canonical insert shapes out — never the internals of either side. The archive is the contract; tests that pin zip-entry names, manifest fields, and round-trip fidelity are testing the promise the format makes to the wild.
- **Primary seam: the Recipe Archive format.** Unit-style tests beside the existing per-format parser tests, in the same style they already use: archives built and read with in-memory zips, DB and filesystem mocked. Writer tests (records → zip: manifest correctness, per-recipe layout, relative media references, cuisine names not ids, rating/favourite/attribution fields). Parser tests (zip → insert shapes: detection via manifest, extraction fidelity, unknown-cuisine dropping, newer-major refusal, corrupt-entry isolation).
- **The centerpiece is a round-trip test** at that same seam: records → writer → zip → Norish parser → insert shapes, asserting losslessness plus the three deliberate losses (unmatched cuisines dropped, ids re-minted, ownership flattened to the importer).
- **Deliberately not re-tested**: the shared import loop's overwrite-on-match semantics (already pinned by its existing test) and view-policy scoping (already the tested behavior of the recipe listing layer — the export service merely delegates to it).
- **One browser E2E in the existing full-stack Playwright project**, per the definition-of-done rule that browser-dependent acceptance needs E2E coverage: sign in, create a recipe, export from settings, feed the downloaded archive back through the import UI, and assert the round-trip lands (which also exercises route auth, streaming delivery, and real media on disk in one pass).
- Prior art: the per-format archive parser tests and the archive-import overwrite test in the shared-server package's test suite; the `ai` project fixtures in the web app's E2E suite.

## Out of Scope

- **Backup or restore of any kind**: ownership preservation, account matching, instance migration, or restoring users, households, favorites-of-others, share links, planned items, groceries, stores, allergies, or preferences. ADR-0022 records this as a decided rejection, not a deferral.
- **A scope picker** ("just my recipes" vs "everything I can see") — one semantic for now.
- **Media include/exclude toggles** — everything is always in.
- **Background-job export** with server-side artifacts, ready-notifications, or resumable downloads. Moving to a job later is additive and does not touch the format.
- **Skip-on-match or merge import semantics** — the Norish format inherits the shared loop's overwrite-on-match unchanged.
- **Mobile app export UI** — the archive imports and exports through the web app.
- **Cross-version migration tooling** beyond the manifest's major-version refusal.
- **Auto-creating or tag-demoting unknown cuisines on import** — decided against in ADR-0022.

## Further Notes

- The glossary term is **Recipe Archive** (`CONTEXT.md`, _Imports & AI_): the portable, ownership-free exchange format — explicitly not a backup. Implementation and UI copy should use this language; "export" is the verb, never the artifact.
- ADR-0022 (_Recipe Archives are portability, not backup_, in the imports area) records the format's semantics and rejected alternatives; the format is effectively frozen once archives exist in the wild, so `recipe.json` and manifest shape changes during review are cheap now and impossible later.
- Definition of done follows the repo gates plus feature docs: release notes for the Target Version and a docs page per the feature-docs guide, and the i18n check across all locales for the new strings.
- Preparatory refactors (e.g. extracting the archive writer's input assembly, the favourite extension to the import loop) belong as separate commits in the same PR, per the maintainer's convention.
