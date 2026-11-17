# 38: Loading states

**What to build:** One loader and a launch that holds the splash. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Loading").

**Blocked by:** none

**Status:** open

- [x] One shared loader on the native activity indicator, centring itself; it replaces every `ActivityIndicator` and HeroUI `Spinner`. A skeleton wherever the data's shape is known.
- [x] The library's load-more footer is centred in the space above the tab bar and accessory.
- [x] While a session restores at launch, the splash logo stays until the shell or Sign in is ready; the loader shows under it only after about a second (`app/_layout.tsx`'s bare indicator goes).
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Inventory: `Loader` (components/loader.tsx) is the native indicator in the theme's muted tone, plain by default; `centred` fills its parent. 11 sites: launch and callback through `BrandLoader` (owns the gap under the brand), auth gate, sign-in and provider buttons, share create, step and gallery upload overlays, plan-recipe row, the library's load-more footer, and the session ground while a session ends. Skeletons: the share sheet's link rows and a pending grocery price. Stays: `ImportSpinner` on pending import cards, a drawn accent arc turning through `lib/motion/spin` and still under Reduce Motion.
- Decided: a button's own pending state is a plain `Loader`. The splash latches its loader in the launch context when the hold ends (~0.9 s) with no handoff, so it fades with the splash and survives the provider remount. After the launch, a pending session shows the loader (`resolveSessionView`), so a sign-out waiting on the server is never blank.
- Footer: `loadMoreFooterBox` (features/recipes/utils) is the box from the last card to the accessory's top; the loader centres in it. Numbers measured on the iPhone 17: accessory top 76 pt up minimised, 139 pt expanded, the list's end padding 206 pt (`insets.bottom` is 85 under the tabs). Expanded vs minimised follows the scroll direction, as `onScrollDown` does.
- Simulator (iPhone 17, Release): footer centred at the list's end minimised, list and grid, light and dark. Share rows and price skeletons seen (the price by forcing a Pending Link at a proxy). Sign-out with the server hanging shows the loader, then Sign in. Cold launch signed in: logo, slogan, shell, no bare spinner. Maestro sign-out and offline-launch pass.
- Unseen: the footer with the bar expanded at the list's end (a gesture could not expand the bar there; the expanded numbers come from a screenshot and the unit test), a phone with no home indicator (modelled only), the other loaders (callback, uploads, share create).
- The loader under the splash logo was never seen, and shows only if the device's own read of the saved session is slow: `useMobileSession` reads the persisted session from SecureStore while the server is pending, offline or errored, never waiting on the network, and no saved session reads as signed out at once, so signed in, signed out, offline and slow server all resolve on that read alone.
