# 36: A timed-out reading flags its food and is not counted

**What to build:** Found by ticket 31. With AI on, 3 of 151 reading requests ran over the 10 s budget each request has since ticket 26's review fix (`REQUEST_BUDGET_MS`), all in the first 35 s of the pass while many ran at once (the machine was busy, load average about 7). Two of the foods are no longer flagged after the follow-up passes; one is left flagged `ai-unavailable` until the nightly sweep. Ticket 12's run, under the old 30 s budget over the whole question, had none.

The requests still finished and used tokens (the log has 151 completions), but the job monitor's ledger counted 148 OpenAI requests, 3 short, as many as timed out: a request that times out is in neither the requests nor the tokens.

- On the production copy: 3 timeouts, 1 food left flagged, 3 requests and their tokens missing from the Models row.
- To decide: a longer budget for the reading request, and recording a timed-out request in the ledger as failed with what it used.

**Blocked by:** None

**Status:** done

- [x] A busy pass leaves no food flagged `ai-unavailable` for a slow answer.
- [x] The job monitor counts every request sent, timed out ones too.

## Implemented (2026-10-22)

**The cause of the missing ledger entries.** `withTimeout` raced the request and gave up on it without ending it. The request went on, finished and recorded `completed` with its tokens, but into the food's own ledger (`queue/src/ingredient-review/worker.ts` opens one per food and copies it into the attempt's ledger once `ask` returns), which had already been copied. So the attempt's Models row never saw it.

**What changed.**

- Runtime: `generateStructured` and `decide` take an optional `timeoutMs`, the deadline of that one request (`requestSignal(deadlineMs)`); the transport's idle timeout and the cached undici agent keep the administrator's AI timeout, so the agent is not rebuilt per feature. A request past its deadline is aborted inside the runtime and recorded `failed` (no tokens: none come back) before the feature sees the error. `isTimedOut(error)` in `ai/runtime/errors.ts` tells a deadline or transport timeout from a stopped job (an `AbortError`, not retried).
- `ingredient-resolution.ts`: `REQUEST_BUDGET_MS` 30 000 (was 10 000), passed as `timeoutMs`; `withTimeout` is gone from it. `onceMoreOnTimeout()` asks once more after the first request that times out. The reading's shape retry (ticket 24) shares one: at most one timeout retry and one shape retry, so three requests at most. The language model's pick gets its own. The Decision is not retried: a timed-out Decision falls back to the language model as before.
- Tests: `structured-output.test.ts` and `decide.test.ts` ("ends a request past the feature's own deadline, recorded as a failed use"), the job-stop test asserts a stop is no timeout; `review.test.ts` "a request that runs out of time" (once more and answered, twice flagged `ai-unavailable`, timeout + broken shape = 3 requests, Decision timeout -> language model asked once more). All red first.
- Cost: one more request per timed-out question. A food whose reading times out twice now waits up to 60 s for its worker slot.

**For Mike.** A timed-out request shows as a failed chip on the job monitor with no tokens, though the provider may bill what it generated before the abort. No release-notes line: the per-request budget was never in the notes.
