// @vitest-environment node
/**
 * Pacing store visits. Concurrency 1 plus this is the whole fence in front of
 * somebody else's supermarket.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  paceStoreVisit,
  resetStoreVisitPacingForTests,
  visitKey,
} from "@norish/queue/store-lookup/pace";

describe("paceStoreVisit", () => {
  beforeEach(() => {
    resetStoreVisitPacingForTests();
  });

  it("runs the first visit to a shop straight away", async () => {
    await expect(paceStoreVisit("dirk.nl", () => Promise.resolve("html"), 5)).resolves.toBe("html");
  });

  it("never lets two visits to one shop overlap", async () => {
    let inFlight = 0;
    let overlapped = false;
    const visit = async () => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      return "html";
    };

    await Promise.all([
      paceStoreVisit("dirk.nl", visit, 1),
      paceStoreVisit("dirk.nl", visit, 1),
      paceStoreVisit("dirk.nl", visit, 1),
    ]);

    expect(overlapped).toBe(false);
  });

  it("leaves a pause between visits to the same shop", async () => {
    const started: number[] = [];
    const visit = () => {
      started.push(Date.now());

      return Promise.resolve("html");
    };

    await Promise.all([paceStoreVisit("dirk.nl", visit, 40), paceStoreVisit("dirk.nl", visit, 40)]);

    expect(started[1]! - started[0]!).toBeGreaterThanOrEqual(35);
  });

  it("keeps a visit to one shop out of another shop's queue", async () => {
    const order: string[] = [];

    await Promise.all([
      paceStoreVisit(
        "dirk.nl",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          order.push("dirk");
        },
        1
      ),
      paceStoreVisit(
        "ah.nl",
        () => {
          order.push("ah");

          return Promise.resolve();
        },
        1
      ),
    ]);

    expect(order).toEqual(["ah", "dirk"]);
  });

  it("carries on after a visit that threw", async () => {
    await expect(
      paceStoreVisit("dirk.nl", () => Promise.reject(new Error("blocked")), 1)
    ).rejects.toThrow("blocked");
    await expect(paceStoreVisit("dirk.nl", () => Promise.resolve("html"), 1)).resolves.toBe("html");
  });

  it("paces by shop, which is a host with or without its www.", () => {
    expect(visitKey("https://www.dirk.nl/zoeken/producten/kaas")).toBe("dirk.nl");
    expect(visitKey("https://dirk.nl/boodschappen/kaas/97752")).toBe("dirk.nl");
  });
});
