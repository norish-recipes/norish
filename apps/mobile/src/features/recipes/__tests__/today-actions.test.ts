import { todayMenuActions } from "@/features/recipes/utils/today-actions";
import { describe, expect, it } from "vitest";

describe("todayMenuActions", () => {
  it("lists the board's menu with Remove last", () => {
    expect(todayMenuActions(true)).toEqual(["open", "move", "remove"]);
  });

  it("leaves out Open recipe for a note", () => {
    expect(todayMenuActions(false)).toEqual(["move", "remove"]);
  });
});
