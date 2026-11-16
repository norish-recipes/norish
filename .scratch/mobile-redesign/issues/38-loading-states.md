# 38: Loading states

**What to build:** One loader and a launch that holds the splash. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Loading").

**Blocked by:** none

**Status:** open

- [ ] One shared loader on the native activity indicator, centring itself; it replaces every `ActivityIndicator` and HeroUI `Spinner`. A skeleton wherever the data's shape is known.
- [ ] The library's load-more footer is centred in the space above the tab bar and accessory.
- [ ] While a session restores at launch, the splash logo stays until the shell or Sign in is ready; the loader shows under it only after about a second (`app/_layout.tsx`'s bare indicator goes).
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
