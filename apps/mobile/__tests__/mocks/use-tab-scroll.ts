// A tab's scroll at rest: `vi.mock` `@/lib/use-tab-scroll` with
// `() => import(".../__tests__/mocks/use-tab-scroll")`.
export const useTabScroll = () => ({
  offset: { value: 0 },
  onScroll: undefined,
  minimised: false,
  homeIndicator: 0,
  barBottom: 0,
});
