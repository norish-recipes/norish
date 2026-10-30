# 05: Prefactor: one browser render and one connection per renderer

**What to build:** The CDP code stops being Obscura's, ready for a second CDP renderer, and the chain behaves the same as before.

- The connection module caches one connection, and one attempt in flight, per renderer name, keyed by endpoint and token.
- Obscura's render becomes one browser render function that takes the renderer's name, its endpoint and token, the timeout, the tokens, the "is settled" reading and a token-setting step. Obscura passes its existing step.
- Three fixes ride along:
  - **The race.** A connection that resolves after a newer attempt is closed, never cached.
  - **One deadline.** The connection, any preliminary navigation and the main navigation share the navigation timeout; the settle wait keeps its own.
  - **Reachability.** An unreachable renderer is logged at error level with its name and its endpoint without the query string. It still counts as no HTML for the chain, and household members see the usual fetch failure.

Spec: `.scratch/chromium-browser-renderer/spec.md` (One browser render; Connections).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Two renderer names with different endpoints keep separate connections. Concurrent renders on both never close each other's connection.
- [x] A setting change replaces only that renderer's connection, and shutdown closes all of them.
- [x] An older connection attempt that resolves last is closed, never cached. The test fails before the fix.
- [x] One Obscura attempt with cookie tokens finishes within the navigation timeout plus the settle deadline. Today the connection, robots.txt navigation and main navigation each get their own. The test fails before the fix.
- [x] An unreachable endpoint is logged at error level, without its query string.
- [x] The swallowed-error branches in callers' tests are removed, or made reachable.
- [x] Obscura's names (function names, log text, error strings) leave the shared path. Obscura-specific wording stays in Obscura's token-setting step.
- [x] The existing chain, token and private-address tests pass unchanged in what they assert.
