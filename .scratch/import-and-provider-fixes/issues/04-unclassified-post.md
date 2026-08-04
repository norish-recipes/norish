# 04 — Unclassified Post: silence is not absence

**What to build:** A self-hoster importing an Instagram reel gets a video recipe, not a
caption-scrape. Today classification asks the downloader for a duration and reads its absence
as "no video", so on some yt-dlp versions every reel loses its video and its creator, and
reels whose caption is not a whole recipe fail outright.

Closes [#513](https://github.com/norish-recipes/norish/issues/513).

**Blocked by:** 01.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

Media-entry selection and the video-stream question are already written and uncommitted. What
is new here is the union, the narrowed catch, and the seam.

- [ ] The video-stream answer is a **three-state union** naming present, absent and unknown.
      The optional boolean goes, and so do the comments in three files warning that a
      truthiness check is wrong — the type stops permitting the mistake, so prose stops having
      to forbid it. This mistake against duration is exactly what caused the bug.
- [ ] A reel takes the video path whether or not it reports a duration.
- [ ] A genuine photo post still imports from its caption.
- [ ] An Unclassified Post attempts the video path, and falls back to the caption **only when
      length validation or the media download failed** — the signals that actually mean there
      was no video here.
- [ ] **A transcription or AI failure propagates and fails the import.** It must not degrade to
      a caption-only recipe, which would hand the user a thin recipe with no signal that the
      transcription provider is down — the same silent-degradation shape as the bug being
      fixed.
- [ ] A new test at the processor's entry point, with the metadata, download and transcription
      boundary faked, covers all four paths plus the propagating failure. This is the only seam
      that can express the narrowed catch, because the pure helpers do not throw. The existing
      pure-helper tests stay underneath it.
- [ ] The two dead Instagram helpers are deleted — including the duration-based detection,
      which is this bug preserved verbatim in a live module with zero callers. The URL
      predicate beside them has ten callers and stays.
- [ ] The GitHub issue is closed with a comment.

## Comments
