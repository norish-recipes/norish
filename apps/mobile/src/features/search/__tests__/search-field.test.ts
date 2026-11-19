import { describe, expect, it } from "vitest";

import type { FieldState } from "../utils/search-field";
import { CANCEL_WINDOW_MS, fieldStep, FRESH_FIELD } from "../utils/search-field";

const holding = (text: string, confirmed = false): FieldState => ({
  ...FRESH_FIELD,
  text,
  confirmed,
});

describe("the search field", () => {
  it("takes what is typed and un-confirms a confirmed search", () => {
    const { state } = fieldStep(holding("soup", true), { type: "typed", text: "soups" }, 1000);

    expect(state).toMatchObject({ text: "soups", confirmed: false });
  });

  it("confirms a text with the search key, and not an empty one", () => {
    expect(
      fieldStep(holding("soup"), { type: "submitted", text: "soup" }, 1000).state.confirmed
    ).toBe(true);
    expect(fieldStep(holding(""), { type: "submitted", text: "  " }, 1000).state.confirmed).toBe(
      false
    );
  });

  it("keeps a text that is not changed", () => {
    const state = holding("soup", true);

    expect(fieldStep(state, { type: "typed", text: "soup" }, 1000).state).toBe(state);
  });

  it("clears the text with the clear button", () => {
    const { state, push } = fieldStep(holding("soup", true), { type: "typed", text: "" }, 1000);

    expect(state).toMatchObject({ text: "", confirmed: false });
    expect(push).toBeUndefined();
  });

  it("restores the text UIKit empties right after Cancel, whichever came first", () => {
    const cancelledFirst = fieldStep(holding("soup", true), { type: "cancelled" }, 1000).state;
    const ignored = fieldStep(cancelledFirst, { type: "typed", text: "" }, 1000 + 50);

    expect(ignored.state).toBe(cancelledFirst);
    expect(ignored.push).toBe("soup");

    const wiped = fieldStep(holding("soup", true), { type: "typed", text: "" }, 1000).state;
    const restored = fieldStep(wiped, { type: "cancelled" }, 1000 + 50);

    expect(restored.state).toMatchObject({ text: "soup", confirmed: true });
    expect(restored.push).toBe("soup");
  });

  it("treats an emptying outside the window as the reader's", () => {
    const cancelled = fieldStep(holding("soup", true), { type: "cancelled" }, 1000).state;
    const { state } = fieldStep(cancelled, { type: "typed", text: "" }, 1000 + CANCEL_WINDOW_MS);

    expect(state.text).toBe("");

    const wiped = fieldStep(holding("soup", true), { type: "typed", text: "" }, 1000).state;

    expect(fieldStep(wiped, { type: "cancelled" }, 1000 + CANCEL_WINDOW_MS).push).toBeUndefined();
  });
});
