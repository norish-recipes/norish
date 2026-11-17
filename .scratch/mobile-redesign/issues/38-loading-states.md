# 38: Loading states

**What to build:** One loader and a launch that holds the splash. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Loading").

**Blocked by:** none

**Status:** open

- [x] One shared loader on the native activity indicator, centring itself; it replaces every `ActivityIndicator` and HeroUI `Spinner`. A skeleton wherever the data's shape is known.
- [x] The library's load-more footer is centred in the space above the tab bar and accessory.
- [x] While a session restores at launch, the splash logo stays until the shell or Sign in is ready; the loader shows under it only after about a second (`app/_layout.tsx`'s bare indicator goes).
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Inventory: 13 loaders. 12 became the shared `Loader` (components/loader.tsx, native indicator, theme muted, centres itself; `inline` for a button's or row's own slot): the launch (now inside the splash), callback, auth gate, sign-in and provider button indicators, share create and list, step and gallery upload overlays, plan-recipe row, grocery price, library load-more footer. 0 became skeletons: every remaining one waits on data of unknown shape or a button's action; the data-backed views already had skeletons. Stays: `ImportSpinner` on pending import cards (a designed arc that keeps turning under Reduce Motion). No pull-to-refresh, share extension or widget loaders exist.
- Decided: a button's own pending state uses `Loader inline` (still the button's). The splash loader shows once the hold ends (~0.9 s) with no handoff yet, latched in the launch context so it fades with the splash and survives the provider remount; `resolveLaunchLoader` is the tested rule. The footer is a 64 pt strip ending where the tab bar/accessory clearance begins.
- Simulator (iPhone 17, Release): signed-in, cached/slow-server and signed-out cold launches show logo then crossfade, no bare spinner, no flicker; footer centred above accessory, dark/light, minimised; Maestro recipes-browse-filter, sign-out, offline-launch pass. Unseen: the loader under the logo. With no cached session the app resolves signed out at once, so session restore was never pending on the simulator; only the unit test covers it. Footer shown only minimised/at end (expanded bar shot not at list end). Other loaders (share, uploads, callback) were not driven.
