import { describe, expect, it } from "vitest";

import {
  ConnectionMonitorProvider,
  formatServings,
  isDirtyState,
  useConnectionMonitor,
  useDirtyState,
  useGroceryFormState,
  useScrollRestoration,
  useServingsScaler,
  useUnitFormatter,
  useUserAvatar,
} from "@norish/shared/react/hooks";

describe("shared react hooks exports", () => {
  it("exports runtime-safe hooks", () => {
    expect(typeof isDirtyState).toBe("function");
    expect(typeof useDirtyState).toBe("function");
    expect(typeof useGroceryFormState).toBe("function");
    expect(typeof useUserAvatar).toBe("function");
    expect(typeof useServingsScaler).toBe("function");
    expect(typeof formatServings).toBe("function");
    expect(typeof useScrollRestoration).toBe("function");
    expect(typeof useConnectionMonitor).toBe("function");
    expect(typeof ConnectionMonitorProvider).toBe("function");
    expect(typeof useUnitFormatter).toBe("function");
  });
});
