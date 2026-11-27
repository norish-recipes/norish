# Launch roadmap

Type: wayfinder map

## Destination

A roadmap from today to the hosted Norish service taking its first paying customer: ordered milestones, each saying how it works and what is still open. Milestones become specs only when started; this map holds no implementation tickets.

## Notes

- Hosted = one shared instance, each Household a tenant; the Permission Policy is Household.
- Every hosted rule is its own setting; "hosted" and "demo" are configurations a self-hoster can copy.
- Research lives in `research/`: [comparable pricing](research/comparable-pricing.md), [unit economics](research/unit-economics.md), [store and licence rules](research/store-and-licence-rules.md).

## Milestones

1. **Household boundary** (in flight, `.scratch/household-boundary`). Nothing one household makes is seen by another.
2. **AI budgets per Account.** The admin sets a monthly spend in euros per Account; the person sees only a percentage meter. Cost = tokens x model price, recorded per call in Postgres (today's model-use ledger lives only in BullMQ progress and is lost). Every AI call, background enrichment included, is charged to the Account that triggered it. When spent: AI features say so and when it renews; imports fall back to the non-AI parser; nothing queues for next month.
3. **Abuse hardening.** One Valkey limiter (reusing the API-key fixed window) caps writes and expensive work per Account per hour, plus a loose per-IP read limit. Fixes found by the audit:
   - throttle household join codes (6 digits, no attempt limit: brute-forceable)
   - zip-bomb limits on archive import (size, entries, uncompressed bytes)
   - one egress proxy applying the private-address guard, used by yt-dlp, Chromium (subresources) and Obscura; CalDAV gets the guard; hosted also blocks private ranges at the network
   - video import limited to known sites on public instances
   - WebSocket `maxPayload` and connection cap
   - app-wide CSP and HSTS
   - Suspend action in the existing user management (own column, sessions revoked); no Better Auth admin plugin, no impersonation
   - storage cap per Account (~2 GB on hosted)
4. **Writable public demo** (replaces `.scratch/demo-instance`, read-only, never built). "Try the demo" clones a pre-built household into a throwaway Account per visitor that lives 30 minutes; the whole demo rebuilds nightly. Registration stays off; limits per Account and IP. Off: manual uploads, share links, API keys, household joining, image generation. On: automatic AI only (import fallback, enrichment, ingredient icons, video import), under a per-Account cap and one daily cap for the whole demo; past the cap imports use the non-AI parser.
5. **Sign-in security.** Passkeys and two-factor (Better Auth 1.7 plugins). Hosted requires a passkey, or password + one-time code; Google/GitHub/Apple/OIDC sign-in counts. Sign in with Apple is added (Apple requires it in the iOS app once Google/GitHub are offered). Transactional email over one SMTP transport (verification, reset); provider sign-ups skip verification when the provider says the email is verified. Without SMTP a self-hosted instance hides email features and admins reset passwords; hosted mode refuses to start without it.
6. **Hosted billing.** Per-Household subscription, EUR, merchant of record (Paddle or Polar), monthly + annual, also sold as an iOS in-app purchase (Apple 3.1.3(b)). No trial: the demo is the trial. A webhook keeps one Subscription state; a tRPC middleware refuses all but billing, account and sign-out without one; web and mobile show a paywall. A failed payment gives 7 read-only grace days; after cancelling, read-only with export for 30 days, then deleted as self-service deletion does. Non-AI imports are unlimited (rate limit aside); plans differ in AI allowance.
7. **Mobile self-hoster unlock.** Free download; one-time in-app unlock to use your own server (Plex/Emby precedent); free while signed in to hosted with a subscription. Everything stays AGPL with no CLA, as Immich, Karakeep and Mastodon ship their store apps.

## Decisions so far

- Destination is a roadmap, not tickets; the read-only demo spec is retired.
- Hosted = one shared instance; billing per Household; EUR, EU-first, merchant of record; no trial.
- AI budget is money per Account, charged to the requester, no queueing past the budget.
- Demo: one throwaway Account per visitor, manual uploads off, only automatic AI, per-Account rate limit.
- Email over SMTP, MFA mandatory on hosted, Sign in with Apple, egress through one guarded proxy, suspend added to existing user management.
- Hosted and demo are configurations of separate settings, not a mode switch.
- Keep AGPL, no CLA; trademark policy protects the name.

## Open (awaiting Mike)

- Plan shape for a Household of up to 4 (Q33-35) and the demo cap amounts (Q36).
- Trademark check on "Norish".

## Not yet specified

- Hosting infrastructure: box, object storage for uploads, backups, monitoring, status page.
- Legal: terms, privacy policy, GDPR processing agreement, imprint, notice-and-takedown for user content.
- What a lapsed Account keeps and for how long, beyond the Q27 proposal.

## Out of scope

- One instance per customer.
