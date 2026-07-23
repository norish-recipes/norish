# Release notes use a release checkpoint

## Status

Accepted and executed on July 22, 2026. The docs were frozen at `0.19.1-beta`, the editable docs label moved to `0.20.0-beta`, and the release notes were written from checkpoint commit `063429cda9759d7b115f5f222ab18b7740e602c0`.

## Problem Statement

Release notes are easier to write once the release work has a sensible Git checkpoint and the docs site has moved to the new version. The project needs a small supported command for that docs transition, not a release-management framework.

## Solution

Choose a practical Git boundary for the release, run the docs command with the maintainer-selected next version, and write the release-note page in the existing Norish style. The command freezes the current editable docs once and updates the editable label. Docusaurus remains responsible for rejecting duplicate snapshots.

## User Stories

1. As a Norish user, I want concise release notes grouped by product area.
2. As a self-hosting administrator, I want breaking, configuration, and migration notes called out clearly.
3. As a contributor, I want user-facing contributions acknowledged.
4. As a release maintainer, I want a useful Git checkpoint before drafting notes.
5. As a docs maintainer, I want one command that freezes the current docs and advances the editable version label.
6. As a docs maintainer, I want the production docs build to prove the resulting site is publishable.

## Implementation Decisions

- The maintainer supplies the next docs version to `pnpm docs_update <next-version>` or enters it at the prompt.
- The command reads the current editable label, asks Docusaurus to freeze that label, and then updates the editable label to the supplied next version.
- The command performs only basic non-empty, version-shaped, and different-from-current input checks. It does not derive a canonical application release or compare manifests.
- Docusaurus is the authority for whether the outgoing version can be frozen. The script does not model “already current,” forward drift, or contradictory generated states.
- The release checkpoint is a maintainer-chosen committed boundary. It is a drafting aid, not an exhaustive provenance audit.
- Release notes summarize user and operator impact in the established Summary, Features or Fixes and Improvements, Upgrade notes, and Contributors structure. Internal-only work may be omitted without a separate inventory artifact.
- The workflow does not publish a GitHub release, create a tag, promote images, or deploy the docs site.

## Testing Decisions

- The docs version script is intentionally thin and has no bespoke framework-level test suite.
- Validation consists of reviewing the generated versioned docs, running the docs format check, and completing a production docs build with broken-link and broken-anchor enforcement.

## Out of Scope

- Deriving or verifying a canonical application release across manifests.
- Provenance audits that classify every commit or pull request.
- Modeling rerun, already-current, forward-drift, or contradictory generated states in the wrapper script.
- Automatically bumping application or mobile versions.
- Creating or pushing final release tags.
- Publishing GitHub releases, promoting container images, or deploying documentation.
- Producing exhaustive developer-facing changelogs.

## Further Notes

- If a maintainer needs to redo or repair a docs snapshot, they should inspect the Docusaurus state directly rather than expecting this convenience command to infer intent.
