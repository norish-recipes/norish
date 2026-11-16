import { describe, expect, it } from "vitest";

import {
  choiceRoute,
  clearChoice,
  parseMultiple,
  requestChoice,
  takeChoice,
} from "../components/editor/choice-request";

const slot = { choices: [{ key: "nl", label: "Netherlands" }], selected: [], onChange: () => {} };

describe("choice slot", () => {
  it("is taken once", () => {
    requestChoice(slot);

    expect(takeChoice()).toBe(slot);
    expect(takeChoice()).toBeNull();
  });

  it("is empty after the editor clears it", () => {
    requestChoice(slot);
    clearChoice();

    expect(takeChoice()).toBeNull();
  });

  it("is empty on a relaunch with nothing pending", () => {
    expect(takeChoice()).toBeNull();
  });

  it("carries the name, title and multiple in the route", () => {
    expect(choiceRoute({ name: "a", title: "A", multiple: true }).params).toEqual({
      name: "a",
      title: "A",
      multiple: "1",
    });
    expect(choiceRoute({ name: "a", title: "A" }).params).toEqual({ name: "a", title: "A" });
  });

  it("reads multiple back from the route", () => {
    const { multiple } = choiceRoute({ name: "a", title: "A", multiple: true }).params as {
      multiple?: string;
    };

    expect(parseMultiple(multiple)).toBe(true);
    expect(parseMultiple(undefined)).toBe(false);
  });
});
