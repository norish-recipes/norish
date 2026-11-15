# 30: Maestro, docs and release notes for Recipe, Groceries and Calendar

**What to build:** The three areas' acceptance run and their docs. See `.scratch/mobile-redesign/spec.md` Parts 3–5 ("Testing Decisions").

**Blocked by:** 29

**Status:** open

- [ ] Maestro flows from Parts 3–5's Testing Decisions; one full run after 18–29 are reviewed and fixed; each new flow run repeatedly to prove it stable.
- [ ] The grocery realtime check returns.
- [ ] Device run of every new board against the canvas.
- [ ] Docs pages for the Recipe screen and timers, Groceries and Calendar, and the widgets page stating that widgets update when Norish runs; release notes for 0.27.0-beta.

## Comments

### Known limits noted during tickets 23-27 (2026-11-15)

- Predicted versions (groceries, stores, planned items): the client bumps a cached version on each optimistic write so the user's own writes in a row land. If the first queued write is refused and another member's change produces exactly the version the second write predicted, the second lands over theirs (a field or a position, not a whole list). The fix is the server applying such writes field by field without a version check, which ADR-0004 considered and deferred. Mike, 2026-11-15: fine for now, keep it noted.
- Mobile has no screen for Parked or Conflicted Outbox entries; they stay and count in sign-out's "N changes". Mike, 2026-11-15: fine for now.
- Grocery writes waiting behind a stalled request reach the Outbox one 20-second timeout apart; an app kill in between loses the ones not yet sent.
- A recipe edit that may already have reached the server, followed by another edit of that recipe, may be refused with the toast (accepted, ticket 23).
