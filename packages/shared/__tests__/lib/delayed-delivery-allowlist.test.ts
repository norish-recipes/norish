import { describe, expect, it } from "vitest";

import {
  delayedDeliveryEligibleMutations,
  delayedDeliveryImmediateOnlyMutations,
  isDelayedDeliveryEligibleMutation,
  isImmediateOnlyDelayedDeliveryMutation,
} from "../../src/lib/delayed-delivery-allowlist";

describe("delayed-delivery allowlist", () => {
  it("keeps create-style and repeat-work mutations immediate-only", () => {
    expect(delayedDeliveryImmediateOnlyMutations).toEqual([
      "groceries.create",
      "recurringGroceries.createRecurring",
      "stores.create",
      "households.create",
      "households.join",
      "calendar.createItem",
      "caldav.triggerSync",
      "caldav.syncAll",
    ]);
  });

  it("keeps security-sensitive household mutations eligible", () => {
    expect(delayedDeliveryEligibleMutations).toEqual(
      expect.arrayContaining([
        "households.leave",
        "households.kick",
        "households.regenerateCode",
        "households.transferAdmin",
      ])
    );
  });

  it("exposes lookup helpers for future outbox gating", () => {
    expect(isDelayedDeliveryEligibleMutation("favorites.toggle")).toBe(true);
    expect(isImmediateOnlyDelayedDeliveryMutation("caldav.syncAll")).toBe(true);
    expect(isDelayedDeliveryEligibleMutation("households.join")).toBe(false);
    expect(isImmediateOnlyDelayedDeliveryMutation("siteAuthTokens.update")).toBe(false);
  });
});
