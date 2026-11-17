// The tab bar's list marker as a pass-through: `vi.mock` `@/components/tab-list-marker` with
// `() => import(".../__tests__/mocks/tab-list-marker")`.
import type { ReactElement } from "react";

export const TabListMarker = ({ children }: { children: ReactElement }) => children;
