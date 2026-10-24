# 02: Device Kind picks the first frame's layout

**What to build:** Phones get the phone layout from the first frame wherever a layout is chosen in JS.

- Every hook that guesses a width on the server takes its server and hydration value from the reader's Device Kind (`useDevicePreferences().kind`):
  - `useIsMobile` and `useMediaQuery`, which answer "no match" on the server
  - the `useWindowSize` defaults in the calendar page (768), the desktop timeline, the library grid and `useContainerColumns` (1024)
- After hydration they follow the window as today, so a narrow desktop window still gets the phone layout once mounted.
- Layouts CSS already switches (the recipe page) are left alone.

See `.scratch/skeletons-and-page-loads/spec.md`, Device Kind on the first frame.

**Blocked by:** None.

**Status:** done

- [x] The calendar's server markup on an iPhone is the phone calendar and its skeleton.
- [x] The library grid's server markup on an iPhone uses phone columns.
- [x] Unit tests: each width hook returns the Device Kind's answer on the server and during hydration.
- [x] `first-paint.e2e.ts` gains the iPhone calendar and library-grid assertions.
- [x] Release notes: covered by 03 to 05's line ("phones get the phone calendar from the start").

**Done 2026-10-15** (`d5941887a`): one `useViewport(read)` in `hooks/use-viewport.ts` answers for the Device Kind (phone 390, desktop 1024) on the server and while hydrating; `useIsMobile`, `useContainerColumns`, the calendar page, the desktop timeline and the library grid's row estimate read it. `useMediaQuery` kept no width caller: cooking mode now reads `!useIsMobile()` (its one-caller hook is gone), and reduced motion stays "no match" on the server. The calendar's `loading.tsx` skeleton also picks by Device Kind. The library-grid E2E guards the first frame; the grid never drew items on the server, so it passed before the change too.
