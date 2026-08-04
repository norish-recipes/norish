# Import and provider fixes

Status: ready-for-agent

## Starting state — read this before anything else

**The working tree is dirty, and it is the starting state, not the target.** Most of this
work is already written and uncommitted on `rc/0.20.0-beta`. Several tickets **change** code
that already exists in the tree, and one **reverts** part of it. Do not read the diff as
finished work.

Already in the tree, uncommitted:

- #511, #513, #514 fixes; the `DEFAULT_YT_DLP_VERSION` constant; the CI per-gate `NODE_ENV`;
  a docs and release-notes rewrite; and roughly 1,500 lines of unrelated Prettier churn.

What the tickets do to it:

- The tri-state video-stream union **replaces** the optional boolean already there.
- The Instagram fallback catch is **narrowed** from the broad one already written.
- The yt-dlp version field becomes **read-only**, undoing part of what is already wired.
- Ticket 01 **reverts** the reformatting of the generated Drizzle migration metadata.

## Problem Statement

Three things are broken for self-hosters, one lies to them, and the repo's own gates are not
holding.

A self-hoster on a recent yt-dlp finds every Instagram reel imported as a photo post: the
video and the creator are lost, and reels whose caption is not a whole recipe fail outright,
while `yt-dlp <url>` in the same container downloads the reel fine (#513). Anyone configuring
a current model — Anthropic's `claude-sonnet-5` among them — finds AI extraction failing
before the model reads the prompt, because the model refuses the configured temperature
(#514). Anyone adding a recipe to the calendar from its detail page finds the slot menu opens
and then ignores every tap (#511).

Meanwhile the admin screen offers a **yt-dlp Version** field that is editable, saved, and read
by nothing at all — and the troubleshooting docs point operators at it precisely when imports
break. And the repo's Format Check gate runs Prettier in write mode against a throwaway CI
checkout, so it has never been able to fail; the Tests gate is genuinely red, because a
workflow-wide `NODE_ENV=production` overrides the value Vitest needs.

## Solution

Import classification stops guessing. Norish asks its downloader whether a post carries a
video stream and models the answer as three states — present, absent, and **Unclassified
Post**, meaning the downloader said nothing either way. Silence is never read as absence. An
Unclassified Post takes the video path, and falls back to the caption only when the download
itself found no media; a failing transcription or AI provider now surfaces as the failure it
is instead of quietly producing a caption-only recipe.

The configured temperature becomes a **Generation Preference**: something Norish asks a model
for and never requires. Norish stops claiming to know in advance which parameters a model
accepts — the dead capability table is deleted — and instead drops a refused preference and
answers the request without it. When that recovery also fails, the original refusal is what
reaches the caller.

**yt-dlp Version** stops being a setting and becomes a report: the release of the binary the
server is actually running, asked of the binary itself, shown read-only. No Norish setting can
change it, because in production the image fixes it and in development the first download
does.

Overlays opened inside a Panel render inside the Panel, so the drawer's inert backdrop cannot
swallow them.

And the gates start holding: Format Check runs the check script that already exists, Tests run
under the environment Vitest expects, and the generated migration metadata is excluded from
formatting so routine schema work cannot turn the board red.

## User Stories

1. As a self-hoster, I want Instagram reels imported as videos, so that I keep the video, the
   creator, and recipes whose caption is not the whole method.
2. As a self-hoster, I want a post my downloader cannot classify to be attempted as a video,
   so that silence is never mistaken for "no video".
3. As a self-hoster, I want a genuine photo post still imported from its caption, so that the
   fix for reels does not break photo imports.
4. As a self-hoster, I want a failing transcription provider to fail my import visibly, so
   that I learn transcription is broken instead of silently receiving thinner recipes.
5. As a self-hoster, I want a failing AI provider to fail my import visibly, for the same
   reason.
6. As a self-hoster, I want an import to still fall back to the caption when there was simply
   no media to download, so that the recovery I rely on survives.
7. As an administrator, I want AI extraction to work on models that refuse a temperature, so
   that choosing a current model does not break every AI feature.
8. As an administrator running a model behind a generic or local endpoint, I want the same
   protection, so that Norish does not assume it knows my model.
9. As an administrator, I want the temperature I configure still honoured by models that
   accept it, so that the setting keeps meaning something.
10. As an administrator, I want a failed recovery to report the model's original objection, so
    that I debug the real problem rather than whatever went wrong second.
11. As a maintainer, I want no capability table in the codebase claiming to know a model's
    parameters, so that nobody builds on a promise the code never kept.
12. As an administrator, I want the yt-dlp version shown to be the one my server is actually
    running, so that it is worth checking when imports break.
13. As an administrator, I want that field to be read-only, so that I am not invited to change
    something no setting can change.
14. As an administrator, I want the field to say so plainly when no downloader binary is
    present, so that "unknown" is never displayed as a version.
15. As a self-hoster reading the troubleshooting docs, I want the version they tell me to check
    to be real, so that the advice is worth following.
16. As a maintainer, I want the shipped yt-dlp release named in exactly one place, so that the
    image, the environment default, and the documentation cannot drift apart again.
17. As a user on a phone, I want the slot menu to respond when I add a recipe to the calendar
    from its page, so that planning from a recipe works.
18. As a maintainer, I want to know whether other overlays inside a Panel have the same
    problem before deciding how far the fix goes, so that the scope is evidence-led.
19. As a contributor, I want the Format Check gate able to fail, so that formatting drift is
    caught rather than accumulated.
20. As a contributor, I want generated migration metadata exempt from formatting, so that
    routine schema generation does not turn the board red.
21. As a contributor, I want the Tests gate green, so that a red board means something is
    actually broken.
22. As a self-hoster, I want each of these changes recorded in the Target Version's release
    notes, so that I know what an upgrade brings.

## Implementation Decisions

- **AI SDK stays on the v6 line.** The bump holds at the current v6 heads. Reasoning effort
  needs no major migration — it is a provider-level option on both lines — so v7 is deferred
  to its own effort. This upholds the existing decision to track the `ai-v6` dist-tag.
- **Runtime learning is the only capability model.** The declared-but-unpopulated capability
  type and every re-export of it are deleted. Norish asks, and retracts what is refused.
- **A failed retry reports the original error**, with the retry's error attached as its cause.
  The retry is speculative recovery; its failure is a detail of the recovery, not the
  diagnosis.
- **The video-stream answer is a three-state union**, not an optional boolean. Naming the
  third state removes the falsy trap that caused #513 in the first place, and retires the
  comments that currently warn about it in three files.
- **The Unclassified Post fallback catches only "there was no media"** — length validation and
  media download failures. Transcription and AI failures propagate.
- **yt-dlp Version leaves the writable video configuration** and becomes a report derived from
  the binary. This pulls with it: the locale strings that describe it as a version "to use",
  the seeding that fills it from the environment, and the constant's own documentation.
  The constant survives on the strength of the environment default and the image build
  argument, which a repo-invariant test already pins together.
- **The Panel exposes its own element as a portal container**, and overlays inside a Panel use
  it. How many overlays get wired is decided by verification, not assumption.
- **The formatting gate switches to the check script that already exists.** Generated Drizzle
  migration metadata is excluded from formatting, because the generator's output is not
  Prettier-shaped and regenerating it would otherwise redden the board.
- **The two dead Instagram helpers are deleted** — including the duration-based detection that
  is #513 preserved verbatim in a live module. The URL predicate beside them stays.
- **Image post and photo post remain interchangeable.** Deliberately not canonicalised; no
  glossary term is minted for it.

## Testing Decisions

A good test here asserts what a caller observes — the request that reaches a provider, the
error that reaches the importer, the value the admin screen receives — never how the code is
arranged internally. Prefer the highest seam that can express the behaviour.

- **Provider behaviour** — existing seam: a stubbed transport beneath the model factory and
  `generateText`. Covers temperature dropped, temperature honoured, and the original-error
  guarantee. Prior art: the provider-temperature suite. The middleware's own unit tests stay
  as they are; new cases go at the high seam.
- **Instagram import decisions** — **new seam** at the processor's `process` entry point, with
  the metadata, download and transcription boundary faked. This is the only seam that can
  express the narrowed catch, because the pure helpers do not throw. Covers all four paths:
  reel, photo, unclassified-then-video, unclassified-then-caption — plus a transcription
  failure propagating. The existing pure-helper tests stay underneath it.
- **yt-dlp version report** — the admin query, with the version lookup faked. Covers the
  reported value and the no-binary case in one place. Prior art: the admin router suites.
- **Repo invariants** — extend the existing configuration test that greps the image build for
  the shipped version, so it also pins the workflow to the check script. Same seam, same
  pattern.
- **Panel overlay containment** — left as the existing prop-level test until verification says
  otherwise. If other overlays are affected, raise it to a real render asserting the overlay
  is a descendant of the Panel's content.
- **Formatting and documentation** — CI gates, not tests. The docs build already runs inside
  the repo build.

## Out of Scope

- The AI SDK v7 migration, and reasoning effort as a Generation Preference. Both are their own
  effort; neither is blocked by this one.
- Renaming image post to photo post across the codebase.
- Making yt-dlp Version a real setting the server honours by re-downloading. Rejected: the
  image ships the binary by design.
- Populating a capability table. Explicitly rejected — see the accompanying decision record.
- Generalising the Panel portal container beyond whatever verification shows is affected.

## Further Notes

- Closes #511, #513 and #514 on the community tracker once shipped.
- The release notes entry claiming the reported yt-dlp version is the shipped one is **false
  until the report lands**, because seeding only fills missing keys and existing installs keep
  their stored value. It must be rewritten alongside, and should say the field became
  read-only.
- The documentation carries an unterminated admonition introduced by the uncommitted rewrite,
  plus a copy pass: a missing word in the provenance summary, an em-dash closed with a comma,
  a missing full stop, and "Need" for "New".
- Three glossary terms come out of this work — Generation Preference, Unclassified Post, and
  yt-dlp Version — and one decision record, on Norish never claiming to know which parameters
  a model accepts.
