import { describe, expect, it } from "vitest";

import * as sharedReact from "@norish/shared-react";

describe("shared-react exports", () => {
  it("exports package surface", () => {
    expect(sharedReact).toBeDefined();
  });
});
