# 08 — Prices refresh daily and on demand

**What to build:** A **Price Refresh** re-reads every product an undone grocery points at, once a day in the background and spread over a window, one page at a time with a pause. Every store section gains a **refresh prices** action that queues the same job at once. A read that fails leaves the product untouched, so the row's age note is what tells the reader. A sale ends the first refresh that no longer sees the regular price. A product nobody is buying this week is left alone and is read again the moment it returns to a list with a price older than a day.

**Blocked by:** 04 — the reader and the visit; 06 — a sale ending has to be visible to be tested.

**Status:** ready-for-agent

- [ ] A refresh queue exists with one job per store; the always-on scheduled-tasks worker queues one per store with priced products once a day, spread across a window rather than fired at once; the worker runs one job at a time
- [ ] A job re-reads every product linked from an undone grocery in the store whose read-at is older than a day, one page at a time with a fixed pause, and skips fresher ones
- [ ] A successful read updates the Store Price, currency, regular price (cleared when no longer stated) and read-at, and leaves a Set Price untouched; a failed read changes nothing
- [ ] A product whose page now reads as another currency than the store's other products keeps the reading and becomes Unpriced with a reason
- [ ] The store section header offers "refresh prices", which queues the store's job immediately and also queues its lookup; with the switch off the action is absent and the header notice from 04 explains
- [ ] Refresh results announce over the store realtime channel so every member's rows update
- [ ] Worker tests with the fetch and reader mocked prove the one-day skip, the untouched-on-failure rule, the sale ending and the Set Price surviving; a router test proves the manual action and its switch gate
