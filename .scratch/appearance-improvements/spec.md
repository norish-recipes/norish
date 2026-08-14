# Login Tagline, Avatar Overhaul, Settings Flicker, and iOS App Icon/Splash

Status: implemented — awaiting maintainer review (translations 01, flicker decision 04, simulator checks 05/06)

Decisions in this spec come from a grilling session on 2026-08-14. Vocabulary: **Avatar** (a person's profile picture) and **App Icon** (the Norish mark as platforms present it) are defined in `CONTEXT.md`; the avatar caching contract is ADR-0021.

## Problem Statement

Four presentation-layer problems, unrelated in code but reported together:

1. The login subtitle still reads "Nourish every moment." in all 14 locales; the product tagline is now "Any source, any recipe." (The French translation is also broken: "Nourish à chaque moment.")
2. Opening `/settings` visibly loads, flickers, and loads again.
3. Avatars misbehave everywhere: an installed app keeps showing a replaced avatar forever, plain tabs show a blank-then-pop flash on settings, recipe author chips sometimes render nothing, and the settings avatar is a rounded square while the navbar's is a circle. Root cause of the staleness/flash: uploads reuse one stable URL served `no-store`, which the service worker's CacheFirst image route ignores (see ADR-0021).
4. The iOS App Icon fights Liquid Glass: our `apple-touch-icon.png` is a white circle on transparency, which iOS composites onto black and then glassifies. The splash screen appears only sometimes because the `apple-touch-startup-image` matrix has device gaps and iOS requires exact matches, frozen per install.

## Solution

1. **Tagline** — en becomes "Any source, any recipe."; the other 13 locales get native translations drafted for maintainer review (ticket 01).
2. **Avatar contract** — versioned immutable URLs per ADR-0021: new filename per upload, `immutable` caching, predecessor file retained until the next upload's cleanup, `memberProfileUpdated` household event (ticket 02).
3. **Avatar front-end** — full rewrite of the avatar component, hook, and every call site: circle at every size, a size prop instead of free-form classes, initials rendered under the image while loading and on 404. Presentational only; data paths unchanged. No settings prefetch. Avatars stay out of the Warm Set; initials are the accepted offline rendering (ticket 03).
4. **Settings flicker** — diagnosis first, by explicit decision: record a real trace of the navigation before speccing any fix. Code reading suggests a four-frame sequence (route skeleton → Suspense text fallback → dynamic-import skeleton → content, plus the admin-tab list remount), but the fix's acceptance criterion is chosen only after the trace confirms it. The ticket also removes the three `/settings/<tab>` redirect stubs — one real route remains, `/settings?tab=…` (ticket 04).
5. **App Icon** — flat, fully opaque, full-bleed square: green `#336640` fill, cream `#FFFEF7` N-fork mark at ~65% of canvas; regenerate 180/192/512. iOS applies the squircle and Liquid Glass itself; no web mechanism controls the glass/dark/tinted variants and none is attempted (ticket 05).
6. **Splash** — complete the startup-image device matrix and keep it current each September; document the remove-and-re-add retest requirement (ticket 06).

## Out of scope

- Warm Set changes for avatars.
- Any attempt to imitate or override platform icon treatments.

## Tickets

- `issues/01-login-tagline.md` — tagline in en + 13 native translations
- `issues/02-avatar-caching-contract.md` — ADR-0021 server side
- `issues/03-avatar-frontend-rewrite.md` — component/hook/call-site rewrite (blocked by 02)
- `issues/04-settings-flicker-trace.md` — diagnosis, ends in a decision
- `issues/05-app-icon-liquid-glass.md` — opaque full-bleed icon set
- `issues/06-splash-matrix.md` — startup-image device matrix completion
