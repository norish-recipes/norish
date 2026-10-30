# 42 — The AI transport takes fetch and Agent from one undici

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md` decision 4, ticket 15. Found in the branch review on 2026-10-13.

## What to build

`packages/shared-server/src/ai/runtime/transport.ts` calls the global fetch with an undici 8 `Agent` as its dispatcher.

**Why that is a problem:**

- The global fetch is the undici that Node bundles. It only accepts the `Agent` while our undici is the same major.
- So everything is tied to Node's version:
  - `engineStrict: true`, with its comment, in `pnpm-workspace.yaml`
  - the "move the pin when Node bundles a new undici major" note in `transport.ts`
  - ticket 15's claim that Vitest 5 and tsdown 0.23 need Node 26. They don't: vitest 5.0.4 and tsdown 0.23.1 both accept Node 22 and 24.
- The stated reason for using the global fetch is that tests or deployments which patch `globalThis.fetch` still see these calls.

**The fix:**

1. Use `import { Agent, fetch } from "undici"`, so the dispatcher and fetch always come from the same package.
2. Find anything that relies on patching `globalThis.fetch` for AI calls, and give it a proper seam instead. The review found that only the provider-listing tests stub it, and they don't go through the transport.
3. Drop `engineStrict` and both comments. Nothing moves off Node 26: `engines`, `.nvmrc` and the image stay on it, because decision 4 chose it on its own merits. This only stops the next undici or Node major from having to move together.
4. Update spec decision 4, which still says undici 8 and Node 26 move together.

Land this before `.scratch/architecture-after-upgrades/` ticket 03, which passes an abort signal through the same transport.

## Acceptance criteria

- [x] `transport.ts` imports `fetch` and `Agent` from undici.
- [x] No comment, setting or spec decision ties undici's major to Node's.
- [x] The `ai` E2E project passes.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 (implemented) — `createFetchWithTimeout` calls undici's own `fetch` with undici's `Agent`. `engineStrict` and its comment are gone from `pnpm-workspace.yaml`, the "move the pin" note from `transport.ts`, and spec decision 4 now says the next undici or Node major moves on its own. `engines`, `.nvmrc` and the image stay on Node 26.
  - **Found on the way: multipart uploads.** undici's fetch sends only its own `FormData` as multipart, and it recognises it by class, per module instance: even at the same 8.11.2 that Node 26 bundles, Node's global `FormData` is not undici's, and went out as `text/plain` "[object FormData]". The AI SDK builds the global one for transcription. `transport.ts` rebuilds a global `FormData` body as undici's before sending; Blob and File are Node's own classes, shared by both, so the entries carry over. The Azure and generic transcription tests, which go through the real transport to a local server, caught it.
  - **Types.** undici's types for Request/Response lag the DOM lib's under TypeScript 6 (no `Symbol.dispose` on header iterators, an extra `duplex`), so the response is bridged with `as unknown as Promise<Response>`, with the reason at the line.
  - **Tests that patched `globalThis.fetch` for AI calls:** more than the review found. `provider-temperature.test.ts` and the openai/groq cases of `transcription.test.ts` stubbed it, and with undici's fetch they reached the real APIs with fake keys. Both now mock `@norish/shared-server/ai/runtime/transport` instead; the transcription test passes through to the real transport unless a case sets a stub. The provider-listing tests stub global fetch but never go through the transport, so they stay.
  - The `ai` E2E project runs with the branch's E2E pass at the end of this batch; its result is recorded here.
- 2026-10-14 (review fixes) — the full `pnpm test:e2e` passed 175 of 175 (ai 143, offline 23, realtime 9) against a build of the review fixes. Ticket 15's out-of-date engine claims are corrected there.
