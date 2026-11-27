import { describe, expect, it } from "vitest";

import { isUncaptured } from "./uncaptured";

describe("isUncaptured", () => {
  it("keeps a send to Bring! out of the Outbox, whose link would be dead on replay", () => {
    expect(isUncaptured("bring.send")).toBe(true);
  });

  it("keeps the credential procedures and every admin procedure out", () => {
    expect(isUncaptured("households.join")).toBe(true);
    expect(isUncaptured("admin.updateGroceryListProvider")).toBe(true);
  });

  it("captures an ordinary write", () => {
    expect(isUncaptured("groceries.create")).toBe(false);
  });
});
