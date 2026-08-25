# 08 — Feature docs and release notes

**What to build:** Cookbooks become discoverable to people who did not build them: documentation pages with screenshots covering what a cookbook is, how to make one, how to file recipes, and how the Library's three chips work — plus a section in the Target Version's release notes.

This slice needs care because no CI gate reaches the documentation site: it sits outside the workspace, so a broken docs build survives a fully green board.

**Blocked by:** 07 — the documentation should describe the finished feature, Offline behaviour included.

**Status:** ready-for-agent

- [ ] Documentation pages cover creating a cookbook, filing a recipe into one, browsing a cookbook, and the three Library chips
- [ ] Screenshots are captured against a running instance with reduced motion enabled, matching how the existing documentation screenshots are produced
- [ ] The Target Version's release notes gain a section for cookbooks
- [ ] The documentation site builds and its links check locally, since no CI gate covers it
- [ ] The documentation uses the glossary's vocabulary — Library, Cookbook, Warm Set, Hidden Item — and does not reintroduce "collection" or "All recipes"
- [ ] No new environment variables or configuration are introduced, so the configuration page and upgrade notes need no change
