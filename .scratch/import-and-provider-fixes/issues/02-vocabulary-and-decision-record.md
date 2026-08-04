# 02 — Domain vocabulary and the capability decision record

**What to build:** The project glossary carries the three terms this work introduced, and a
decision record explains why there is no table anywhere claiming to know what a model accepts
— so the next reader does not helpfully build one.

**Blocked by:** None — can start immediately.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

Pure documentation. Lands early so the tickets below speak the same vocabulary.

- [ ] The glossary gains **Generation Preference**: a generation parameter Norish asks a model
      for — temperature today — that the model is free to refuse. Norish never claims to know
      in advance which parameters a model accepts, because a self-hoster chooses the model; a
      refused preference is dropped and the request answered without it, so a preference is
      never the reason a feature fails. _Avoid_: Model Capability, Generation Setting.
- [ ] The glossary gains **Unclassified Post**: a post whose source gave no evidence either way
      about a video stream. It is not a post without video — reading that silence as absence is
      what sent reels down the caption-only path. _Avoid_: Unknown post.
- [ ] The glossary gains **yt-dlp Version**: the release of the downloader binary a server is
      actually running. A report, not a setting: production fixes it by image and development
      by first download, and no Norish setting changes it. _Avoid_: Configured yt-dlp version.
- [ ] A decision record numbered 0014 records that Norish never claims to know which parameters
      a model accepts — that a declared capability type existed, was never populated or read,
      and was deleted rather than filled in; and that the rejected alternative was populating
      it, which is the thing that lagged and caused the failure in the first place.
- [ ] The glossary stays a glossary. No implementation detail, no spec content.
- [ ] No term is minted for image post versus photo post. The two stay interchangeable by
      decision, and that is the one place this work deliberately declines to pick a single
      word.

## Comments
