import { describe, expect, it } from "vitest";

import { isUncaptured } from "./uncaptured";

describe("isUncaptured", () => {
  it("keeps every Bring Handoff procedure out of the Outbox, whose sheet a replay would outlive", () => {
    expect(isUncaptured("bring.prepare")).toBe(true);
    expect(isUncaptured("bring.update")).toBe(true);
    expect(isUncaptured("bring.discard")).toBe(true);
  });

  it("keeps the credential procedures and every admin procedure out", () => {
    expect(isUncaptured("households.join")).toBe(true);
    expect(isUncaptured("admin.updateGroceryListProvider")).toBe(true);
  });

  it("captures an ordinary write", () => {
    expect(isUncaptured("groceries.create")).toBe(false);
  });
});
