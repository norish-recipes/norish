// @vitest-environment node
import { setTimeout } from "node:timers/promises";
import { inOrder } from "@/scripts/delivery";
import { describe, expect, it } from "vitest";

describe("inOrder", () => {
  it("sends in the order asked, even when a later answer comes first", async () => {
    const sent: string[] = [];
    const pending = new Set<unknown>();
    const deliver = inOrder(10, pending);
    let answer!: (send: () => void) => void;
    const first = deliver(0, new Promise((resolve) => (answer = resolve)));
    const second = deliver(
      0,
      Promise.resolve(() => sent.push("second"))
    );

    await setTimeout(50);
    expect(sent).toEqual([]);
    expect(pending.size).toBe(2);
    answer(() => sent.push("first"));
    await Promise.all([first, second]);

    expect(sent).toEqual(["first", "second"]);
    expect(pending.size).toBe(0);
  });
});
