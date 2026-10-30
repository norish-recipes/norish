# 02 — Bug patterns and security

Status: resolved
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 46 findings (31 files) outside the regex and deprecation groups are fixed, and their rules leave the temporary block.

Counts as measured on 2026-10-14:

- **Likely bugs:**
  - `no-alphabetical-sort` 16: a sort without a comparator sorts numbers and accented names wrongly
  - `no-all-duplicated-branches` 3
  - `no-floating-point-equality` 2
  - `jsx-no-leaked-render` 1
  - `no-try-promise` 1
  - `no-invariant-returns` 1
  - `no-globals-shadowing` 1
- **Security** (now vulnerabilities in SonarQube, no longer review-only hotspots; fix it, or disable a deliberate one with its reason):
  - `pseudo-random` 12
  - `no-clear-text-protocols` 5
  - `no-os-command-from-path` 1
  - `file-permissions` 1
- **Tests:** `assertions-in-tests` 2, both in the E2E suites.

## Acceptance criteria

- [x] None of these rules is in the temporary block, and `pnpm lint` passes.
- [x] Every `eslint-disable` added says why in the same comment.
- [x] A finding that was a real bug gets a test that fails without the fix.
- [x] Every E2E spec that changed passes with `--repeat-each=5`.

## Comments

- 2026-10-14 (implemented).
  - Sorts: a code-unit comparator where the order is stored or keyed and must not move (the source table and the icon manifest, which still serialise byte-identical; the store-lookup job id; the food-name key in `tooling/nutrition`; the ISO timestamps of key rejections); `localeCompare` where the order only has to be stable (query keys, E2E set comparisons, the locale check in General settings).
  - One real bug: OIDC claim mapping picks the first household group "alphabetically", but sorted by code unit, so `Zebra` came before `alpha`. It now uses `localeCompare`; `claim-processor.test.ts` has the mixed-case case, which fails without the fix.
  - The household join code is drawn with `crypto.randomInt` (it grants entry to a household), and yt-dlp's temp files in `os.tmpdir()` are named with `randomUUID()`. The yt-dlp binary is made executable for its owner only (`0o700`).
  - Same-value ternaries collapsed (avatar content type, AI model fetch, grocery subtitle colour); no behaviour changed.
  - `showTimerNotification` checks `typeof Notification` instead of a `try` around the whole call, and returns the `showNotification` promise so its `.catch` sees a rejection.
  - `app/error.tsx` exports `ErrorPage`; `ancestorsOf` returns a fresh empty map for no ids; the leaked `servings &&` reads `servings > 0`; the harness test compares probabilities with `toBeCloseTo`.
  - Disables, each with its reason: `pseudo-random` for the recipe randomizer (file), credential-set rotation, and the two id fallbacks where Web Crypto is missing; `no-clear-text-protocols` for the development-only LAN origins and the `ws://obscura:9222` compose default; `no-os-command-from-path` for `which ffmpeg`; `assertions-in-tests` for two E2E tests whose assertions sit in `expectReorder` and an `expect.poll` the rule does not see.
- 2026-10-14 (review and repeat runs).
  - Review follow-ups: the randomizer's disable became one per line; the OIDC sort pins `localeCompare` to `"en"`, so the pick no longer depends on the server's locale; the stray "0" (`servings && …`) and the unhandled `showNotification` rejection each got a test that fails without the fix. The block pair around the development origins in `auth.ts` stays: five literals in a row with one reason.
  - `--repeat-each=5` over the changed specs: the offline suite 95/95; the ai specs found two races in `grocery-aisles`, both older than this work:
    - `setGrouped` navigated before the grouping preference had saved, so the reload brought back the old choice. The helper now waits for the write.
    - A list read already under way when a grocery was ticked landed over the tick, and the done row closed under the shopper. The grocery mutations now cancel such a read before their optimistic write, as aisle filing already did, and apply the write to the list as held: stopping a read puts back the list as it was when the read began, which on an offline load is the list before the stored copy was restored (the first version of the fix emptied the list there, caught by `offline.e2e.ts`). Two unit tests cover it, one per case, each failing without its half of the fix.
  - After both fixes: `grocery-aisles` 150/150 over fifteen repeats; device-preferences, ingredient-catalogue, reorder-and-swipe and grocery-prices passed every repeat.
