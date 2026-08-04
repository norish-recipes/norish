# 03 — Generation Preference: temperature is asked for, never required

**What to build:** An administrator who configures a current model gets working AI features.
Today a model that refuses the configured temperature — Anthropic's `claude-sonnet-5` among
them — fails every extraction before the model reads the prompt. The configured temperature
becomes a Generation Preference: something Norish asks for and never requires.

Closes [#514](https://github.com/norish-recipes/norish/issues/514).

**Blocked by:** 01.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

The provider bump and the fallback are already written and uncommitted. What is new here is
the error guarantee and the deletion.

- [ ] A model that refuses the configured temperature still answers — the request is retried
      without it, and a model that answered the retry is remembered for the life of the
      process so only the first call pays for the rejected round trip.
- [ ] A model that accepts temperature still receives it. The setting keeps meaning something.
- [ ] **When the retry also fails, the caller receives the model's original objection**, with
      the retry's failure attached as its cause. The retry is speculative recovery; its failure
      is a detail of the recovery, not the diagnosis. Without this a false positive — the
      rejection test is a substring match, and Norish sends recipe text that talks about oven
      temperature — silently swaps the real error.
- [ ] The declared-but-unpopulated capability type is deleted, along with every re-export of it
      across the provider, API and core layers. It had no producer and no consumer; leaving it
      invites someone to build on a promise the code never kept.
- [ ] The provider packages stay on the v6 line. The bump already in the tree is the current v6
      head; do not move to the next major here.
- [ ] The error guarantee is pinned at the high seam — a stubbed transport beneath the model
      factory, as the existing provider-temperature suite does — not only at the middleware.
      The middleware's own unit tests stay as they are.
- [ ] The GitHub issue is closed with a comment.

## Comments
