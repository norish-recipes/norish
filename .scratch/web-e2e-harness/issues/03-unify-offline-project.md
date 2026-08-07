# 03 — Move Offline onto the unified Playwright fixture

**What to build:** Run the complete production-like Offline journey as the `offline` project in the consolidated Playwright configuration, using a plain worker fixture that owns the persistent browser profile and backend reachability controls.

**Blocked by:** 02 — Expand one shared production-stack implementation

**Status:** ready-for-agent

- [ ] A consolidated Playwright configuration exists with a named `offline` project and one shared results directory.
- [ ] The Offline scenarios live beneath the workspace E2E test tree and use the Offline fixture instead of file-level lifecycle globals.
- [ ] The fixture owns one persistent browser context and page across the serial Offline journey.
- [ ] The fixture can select either deterministic identity without clearing the Offline Cache, service worker, IndexedDB, Cache Storage, local storage, or Outbox.
- [ ] The fixture can transition the backend idempotently between Live, stopped, and deliberately unresponsive states.
- [ ] A stopped transition resolves only after the production process has exited and its port is closed.
- [ ] A deliberately unresponsive transition safely binds and later removes the hanging listener.
- [ ] The deterministic Warm Set recipe, primary image, grocery, and calendar note still arm the relevant assertions.
- [ ] Every existing Offline assertion remains present, including Reachability Deadline, Offline Cache, Warm Set, Outbox, identity isolation, sign-out, and Recovery coverage.
- [ ] The `offline` project passes independently and the repository browser gate remains green while the legacy AI runner still exists.
