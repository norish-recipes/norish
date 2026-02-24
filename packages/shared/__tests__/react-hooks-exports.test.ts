import { describe, expect, it } from "vitest";

import {
  isDirtyState,
  useDirtyState,
  useGroceryFormState,
  useUserAvatar,
} from "@norish/shared/react/hooks";

describe("shared react hooks exports", () => {
  it("exports runtime-safe hooks", () => {
    expect(typeof isDirtyState).toBe("function");
    expect(typeof useDirtyState).toBe("function");
    expect(typeof useGroceryFormState).toBe("function");
    expect(typeof useUserAvatar).toBe("function");
  });
});
