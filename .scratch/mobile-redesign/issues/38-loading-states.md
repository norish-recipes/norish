# 38: Loading states

**What to build:** One loader and a launch that holds the splash. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Loading").

**Blocked by:** none

**Status:** done

- [x] One shared loader on the native activity indicator, centring itself; it replaces every `ActivityIndicator` and HeroUI `Spinner`. A skeleton wherever the data's shape is known.
- [x] The library's load-more footer is centred in the space above the tab bar and accessory.
- [x] While a session restores at launch, the splash logo stays until the shell or Sign in is ready; the loader shows under it only after about a second (`app/_layout.tsx`'s bare indicator goes).
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Inventory: `Loader` (components/loader.tsx) is the native indicator in the theme's muted tone, plain by default; `centred` fills its parent. 11 sites: launch and callback through `BrandLoader` (owns the gap under the brand), auth gate, sign-in and provider buttons, share create, step and gallery upload overlays, plan-recipe row, the library's load-more footer, and the session ground while a session ends. Skeletons: the share sheet's link rows and a pending grocery price. Stays: `ImportSpinner` on pending import cards, a drawn accent arc turning through `lib/motion/spin` and still under Reduce Motion.
- Decided: a button's own pending state is a plain `Loader`. The splash latches its loader in the launch context when the hold ends (~0.9 s) with no handoff, so it fades with the splash and survives the provider remount. After the launch, a pending session shows the loader (`resolveSessionView`), so a sign-out waiting on the server is never blank.
- Footer: `loadMoreFooterBox` (features/recipes/utils) is the box from the last card to the accessory's top; the loader centres in it. Numbers measured on the iPhone 17: accessory top 76 pt up minimised, 139 pt expanded, the list's end padding 206 pt (`insets.bottom` is 85 under the tabs). Expanded vs minimised follows the scroll direction, as `onScrollDown` does: `usePlacement` cannot replace it, as react-native-screens mounts both placements at once (`TabsHost.ios.tsx`) and each instance's value is fixed, with no event wired for the shown one. The other tab lists keep the 49 pt extra end space when minimised for the same reason.
- Simulator (iPhone 17, Release): footer centred at the list's end minimised, list and grid, light and dark. Share rows and price skeletons seen (the price by forcing a Pending Link at a proxy). Sign-out with the server hanging shows the loader, then Sign in. Cold launch signed in: logo, slogan, shell, no bare spinner. Maestro sign-out and offline-launch pass.
- Unseen: the footer with the bar expanded at the list's end (a gesture could not expand the bar there; the expanded numbers come from a screenshot and the unit test), a phone with no home indicator (modelled only), the other loaders (callback, uploads, share create).
- The loader under the splash logo was never seen, and shows only if the device's own read of the saved session is slow: `useMobileSession` reads the persisted session from SecureStore while the server is pending, offline or errored, never waiting on the network, and no saved session reads as signed out at once, so signed in, signed out, offline and slow server all resolve on that read alone.

### Review log (2026-11-17)

Range `77448e1d4..eaea719ce`. Standards on Sonnet low, Spec on Opus medium; implemented and fixed on Sonnet medium; reviewed once, the fix round checked on an iOS 27.2 simulator.

Fixed (9): the load-more footer centred between the last card and the bar (it sat in a 64 pt strip under the last card; a geometry test replaces one that only asserted a constant); skeletons for the share sheet's link rows and a pending grocery price; a blank screen for up to five seconds on sign-out (the removed launch indicator had been covering a pending session after launch; test first); the import card's spinner documented as exempt and turning through lib/motion; a stale `ActivityIndicator` mock; the launch loader latched in the provider without a mirrored flag; a plain loader by default with one "loader under the brand" piece.

Closed after checking: the splash never waits on the network (pending clears once the saved session is read from the device), so the loader under the logo shows only if that read is slow; it was not seen on the simulator and a unit test covers its rule.

Known limit: whether the tab bar is expanded or minimised cannot be read in JS (react-native-screens mounts both accessory placements at once and nothing wires `onEnvironmentChange`), so the footer follows the scroll direction, as the bar does; the other tab lists' end padding ignores the minimised bar for the same reason. Both carry a `ponytail:` note.

Not seen on the simulator: the footer with the bar expanded, a phone without a home indicator, the share, upload and callback loaders.

Final state `eaea719ce`: all 11 gates exit 0, mobile lint has no warnings.
