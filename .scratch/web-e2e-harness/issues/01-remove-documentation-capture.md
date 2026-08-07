# 01 — Remove documentation capture from browser acceptance

**What to build:** Make the browser acceptance gate read-only with respect to documentation assets. Remove automated documentation capture while keeping every existing committed screenshot and documentation reference intact.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] The dedicated documentation-capture scenarios and their Playwright configuration are removed.
- [ ] The documentation-capture package command is removed.
- [ ] Offline acceptance no longer writes a tracked screenshot while proving the Offline-unavailable state.
- [ ] Existing committed documentation screenshots remain present and unchanged.
- [ ] Existing documentation continues to reference valid screenshot assets.
- [ ] Running the affected browser acceptance scenario leaves tracked documentation assets untouched.
- [ ] Contributor-facing documentation still states that user-visible features require screenshots, without claiming that screenshot creation is automated.
- [ ] Formatting and applicable focused tests pass.
