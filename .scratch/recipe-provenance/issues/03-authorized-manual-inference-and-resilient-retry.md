# 03 — Authorized manual inference and resilient retry

**What to build:** Let authorized recipe editors request, retry, and deliberately refresh Recipe Provenance while every lifecycle path reaches an understandable terminal state. Existing provenance remains visible during re-inference, viewers remain read-only, and operational failures are shown only to the requesting user.

**Blocked by:** 02 — Paste import to rendered provenance

**Status:** ready-for-agent

- [ ] A recipe viewer can read the authoritative provenance status, an editor can trigger inference, and unauthorized users cannot discover or mutate a private recipe through these procedures.
- [ ] Triggering delegates to the queue producer and returns a typed queued, duplicate, or skipped outcome without duplicating queue, repository, AI, or event logic.
- [ ] Status distinguishes idle, queued, processing, succeeded, and failed, remains correct after navigation or reload, and does not depend on receiving a realtime event.
- [ ] A first inference shows only a localized provenance loading state; re-inference keeps all previous provenance visible while indicating that it is updating.
- [ ] Missing recipes, disabled configuration, invalid structured output, permanent provider errors, transient retries, and final retry exhaustion all leave authoritative terminal state and clear pending UI.
- [ ] Retryable failures use bounded backoff; permanent failures stop immediately; final failure preserves existing provenance atomically.
- [ ] Failed first inference shows a calm editor-only retry action, while a successful retry refreshes the recipe without a manual page reload.
- [ ] Recipe content events follow the existing view policy, while operational failure feedback is targeted only to the user who requested the action.
- [ ] Duplicate or skipped triggers do not emit false started or completed events and do not leave loading active.
- [ ] The mandatory production-like browser E2E controls only the AI-provider response and proves terminal failure, reload-safe status, editor retry, stale provenance preservation during refresh, and successful recovery.
- [ ] Permission, worker reliability, status, subscription, component, locale, and focused browser tests for this slice pass.
