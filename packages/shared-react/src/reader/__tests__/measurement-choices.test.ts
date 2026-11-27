import { describe, expect, it } from "vitest";

import { measurementChoices, shownMeasurement } from "../measurement-choices";

describe("the measurements choices", () => {
  it("offer conversion with AI only where AI is on", () => {
    expect(measurementChoices(true)).toEqual(["off", "metric", "us", "metricWithAI", "usWithAI"]);
    expect(measurementChoices(false)).toEqual(["off", "metric", "us"]);
  });

  it("read a choice of AI made earlier as the same system without it", () => {
    expect(shownMeasurement("usWithAI", false)).toBe("us");
    expect(shownMeasurement("usWithAI", true)).toBe("usWithAI");
    expect(shownMeasurement("off", false)).toBe("off");
  });
});
