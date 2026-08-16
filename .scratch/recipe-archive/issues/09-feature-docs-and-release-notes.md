# 09 — Feature docs and release notes

**What to build:** the documentation that makes the feature real to users and self-hosters, per the feature-docs guide: a docs page covering exporting a Recipe Archive (both doorways, what's inside, what deliberately isn't — ownership, emails, unknown cuisines) with screenshots, and a section under the Target Version's release notes. Copy uses the glossary language: **Recipe Archive** is the artifact, "export" is only ever the verb, and the page says plainly that an archive is portability, not backup (ADR-0022).

**Blocked by:** 03 — A user exports everything they can see; 04 — Media travels inside the archive; 05 — Personal marks and attribution travel; 06 — The format contract is hardened; 07 — An admin exports the whole instance.

**Status:** resolved

- [x] Docs page for the Recipe Archive with screenshots of both doorways, following the feature-docs guide
- [x] The page states the portability-not-backup semantics, the no-PII guarantee, and the unknown-cuisine behaviour in user terms
- [x] Release-notes section added under the Target Version
- [x] All copy uses the CONTEXT.md vocabulary
