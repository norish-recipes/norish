# 04: Delete from a selection

**What to build:** a **Delete** action in the action bar.
- **When it's available:** when at least one selected recipe passes the client's delete-permission check; otherwise it is greyed out.
- **Confirmation:** the shared delete modal from 01, generalised to a count. It says how many recipes will be deleted and how many will stay because the reader may not delete them.
- **On confirm:** only the permitted `{ id, version }` pairs go in one `recipes.delete` call. Visible cards play the existing delete animation, and the selection clears without a toast.
- **Offline:** it is one Outbox entry. On Replay, unchanged recipes are deleted, ones edited elsewhere are kept with the toast from 01, and already-deleted ones count as done.

See `.scratch/library-selection/spec.md`.

**Blocked by:** 01, 03.

**Status:** ready-for-agent

- [ ] E2E: deleting a selection removes those recipes after a confirmation naming the count
- [ ] E2E: a selection including a recipe the reader may not delete says how many stay, and that recipe survives
- [ ] Delete is greyed out when no selected recipe may be deleted
- [ ] Offline E2E (offline project): delete three recipes offline, edit one from a second session, reconnect; two are gone, one is kept, toast shown
- [ ] Gates green
