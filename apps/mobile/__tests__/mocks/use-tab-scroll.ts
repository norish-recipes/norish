import type { TabScroll } from "@/lib/use-tab-scroll";

// A tab's scroll at rest: `vi.mock` `@/lib/use-tab-scroll` with
// `() => import(".../__tests__/mocks/use-tab-scroll")`.
export const useTabScroll = () =>
  ({
    offset: { value: 0, get: () => 0, set: () => {} },
    onScroll: undefined,
    barBottom: 0,
  }) as unknown as TabScroll;
