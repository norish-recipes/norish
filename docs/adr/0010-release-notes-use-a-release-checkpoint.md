# Release notes use a release checkpoint

## Status

Accepted workflow specification — **not executed** as of July 22, 2026. No release checkpoint, docs version transition, release-note page, tag, or publication is created by this ADR-only change.

## Problem Statement

Release-bearing package versions, the editable docs version, versioned docs snapshots, Git history, and release-note pages can drift independently. When notes are written from memory or only from the last few visible commits, significant user-facing work can be omitted. When the docs checkpoint is cut twice or at the wrong version, the version dropdown and editable documentation can also become inconsistent. The project needs a repeatable workflow that creates a current-release checkpoint when one does not yet exist and produces feature-complete release notes in the docs app from an explicit provenance boundary.

## Solution

Treat release-note authoring as a checkpointed docs workflow. Resolve the current release from the canonical release-bearing manifest, make all current-release work part of a committed Git boundary, advance the docs app to that release through its supported version command only when the checkpoint is missing, and generate the release-note page from every change between the previous release tag and the recorded checkpoint. The result follows the existing Norish release-note style and is verified by a production docs build.

## User Stories

1. As a Norish user, I want release notes that cover the complete release, so that I can understand what changed before upgrading.
2. As a Norish user, I want changes grouped by product area, so that I can find the features and fixes relevant to me.
3. As a self-hosting administrator, I want breaking changes, configuration changes, and migrations called out explicitly, so that I can upgrade safely.
4. As a contributor, I want my user-facing contribution acknowledged, so that release notes reflect the people who improved the release.
5. As a release maintainer, I want one explicit Git boundary for the note inventory, so that the release scope is reproducible.
6. As a release maintainer, I want uncommitted current-release work checkpointed before note generation, so that completed features are not omitted from the diff.
7. As a release maintainer, I want a clean worktree to reuse the existing HEAD as the checkpoint, so that the workflow does not create meaningless empty commits.
8. As a release maintainer, I want the previous release tag selected from reachable history, so that unrelated branch lineage does not pollute the notes.
9. As a release maintainer, I want every commit and merged pull request in the checkpoint range classified, so that quiet fixes are not missed.
10. As a release maintainer, I want internal refactors excluded unless they change user or operator behaviour, so that notes remain useful rather than becoming a changelog dump.
11. As a docs maintainer, I want the editable docs label to match the current release, so that new release notes appear under the correct version.
12. As a docs maintainer, I want the outgoing docs version frozen exactly once, so that the version dropdown has a stable historical snapshot without duplicate checkpoint directories.
13. As a docs maintainer, I want an existing current-release checkpoint detected and reused, so that rerunning the workflow is safe.
14. As a docs maintainer, I want version drift that cannot be resolved safely to stop the workflow, so that automation never guesses over a newer docs version.
15. As a release maintainer, I want the release-note page to follow the established summary, grouped-section, and contributor style, so that releases read consistently.
16. As a release maintainer, I want factual claims traceable to code, commits, pull requests, or specs, so that notes do not advertise unfinished work.
17. As a release maintainer, I want the docs production build and link checks to pass, so that the release-note page is publishable.
18. As a future maintainer, I want the checkpoint metadata recorded with the notes, so that later edits know which release boundary was reviewed.

## Implementation Decisions

- The current release identifier comes from the canonical release-bearing root manifest. The workflow verifies that other release-bearing manifests expected to move together agree. A deliberately independent mobile version is not changed merely to satisfy docs release-note generation.
- A Release Checkpoint is a committed Git boundary plus the docs version transition for the current release. If the worktree contains coherent current-release changes, they are committed in a normal checkpoint commit before authoring notes. If the tree is clean, the current HEAD is recorded; no empty commit is created.
- The release-note source range starts at the latest previous final or prerelease tag reachable from the checkpoint and ends at the checkpoint commit. Merge-base and reachability are verified before the range is accepted.
- The draft records the previous release identifier and checkpoint commit as non-user-facing provenance metadata. A rerun reuses that boundary unless the maintainer explicitly refreshes it because more work joined the same release.
- The docs app's supported version command is the only way to create the docs checkpoint. If the editable docs label already equals the current release and the expected outgoing snapshot exists, the command is skipped. If the label is behind, the command advances it to the current release and freezes the outgoing version once. If the label is ahead or the snapshot state is contradictory, the workflow stops rather than hand-editing generated version metadata.
- Release notes live in the docs app's release-notes section and use the current release identifier as the page identity.
- Feature completeness is established by inventorying every commit in the source range and, where available, its merged pull request and originating spec. Each item is classified as user-facing feature, fix/improvement, operator or configuration change, migration/breaking change, documentation, contributor credit, or internal-only.
- Internal-only work is omitted from the published prose but remains accounted for in the inventory. A feature is mentioned only when the checkpoint contains the implemented behaviour; an ADR or plan alone is not release evidence.
- The published page follows the existing Norish style: concise Summary, product-area sections under Fixes and Improvements or Features as appropriate, a clearly visible upgrade/breaking section when needed, and Contributors. Empty ceremonial sections are omitted.
- The authoring workflow may use repository history and GitHub metadata for attribution and context, but the checked-out release code and checkpoint range are the source of truth.
- The workflow does not publish a GitHub release, create a final release tag, promote container images, or deploy the docs site. Those remain later release operations.

## Testing Decisions

- The highest test seam is the supported docs release command run against a temporary fixture representing the version states: missing checkpoint, already-current checkpoint, and invalid forward drift. The test asserts externally visible version labels and snapshot directories, not script internals.
- A provenance audit accounts for every commit in the previous-release-to-checkpoint range. The audit fails if a commit is neither represented in the notes nor explicitly classified internal-only.
- The release-note page is checked for required front matter, matching release identity, valid internal links, and unique sidebar placement.
- The docs app's format check and production build must pass, including broken-link and broken-anchor enforcement.
- Generated docs output remains excluded from formatting inputs according to the docs workspace's ignore rules.
- Validation reports separately whether version checkpointing was created or reused, which Git boundary was used, and which checks passed, failed, or were blocked.

## Out of Scope

- Implementing any product feature described by the release notes.
- Automatically bumping application or mobile versions.
- Creating or pushing final release tags.
- Publishing GitHub releases, promoting container images, or deploying documentation.
- Replacing the existing docs version command or Docusaurus versioning model.
- Producing exhaustive developer-facing changelogs of refactors and test-only changes.

## Further Notes

- At the time this decision was recorded, release-bearing manifests identify `0.20.0-beta`, while the editable docs label and newest release-note page still identify `0.19.1-beta`. Applying this spec should therefore begin by determining whether the `0.20.0-beta` docs checkpoint is missing; this ADR does not create it.
- A checkpoint makes the release-note scope reproducible, but it is not immutable by accident. If additional work is intentionally added to the same release, refreshing the checkpoint and regenerating the inventory must be an explicit action.
