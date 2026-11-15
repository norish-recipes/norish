import { serialQueue } from "@/lib/serial-queue";
import { describe, expect, it, vi } from "vitest";

describe("serialQueue", () => {
  it("runs tasks one after another, past a failure, and stops waiting once reset", async () => {
    const onError = vi.fn();
    const queue = serialQueue(onError);
    const ran: string[] = [];
    const held = Promise.withResolvers<void>();

    void queue.run(async () => {
      await held.promise;
      ran.push("first");
    });
    void queue.run(async () => {
      throw new Error("boom");
    });
    const third = queue.run(async () => void ran.push("third"));

    held.resolve();
    await third;
    expect(ran).toEqual(["first", "third"]);
    expect(onError).toHaveBeenCalledOnce();

    void queue.run(() => new Promise(() => {}));
    queue.reset();
    await queue.run(async () => void ran.push("after reset"));
    expect(ran.at(-1)).toBe("after reset");
  });
});
