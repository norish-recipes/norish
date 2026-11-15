import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@norish/shared-react/platform/testing";
import { useActiveAllergies } from "@norish/shared-react/reader";

import { keyOf } from "../../trpc/testing";
import { createMockHouseholdSettings, readerWrapper } from "./test-utils";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

function render(household: string[] | null, own: string[]) {
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(keyOf("households.get"), {
    household: household ? createMockHouseholdSettings({ allergies: household }) : null,
    currentUserId: "current-user",
  });
  queryClient.setQueryData(keyOf("user.getAllergies"), { allergies: own, version: 1 });

  return renderHook(() => useActiveAllergies(), { wrapper: readerWrapper(queryClient) }).result
    .current;
}

describe("useActiveAllergies", () => {
  it("warns about the household's allergies", () => {
    expect(render(["Peanuts"], ["Gluten"]).allergies).toEqual(["Peanuts"]);
  });

  it("falls back to the Reader's own outside a household or when it names none", () => {
    expect(render(null, ["Gluten"]).allergies).toEqual(["Gluten"]);
    expect(render([], ["Gluten"]).allergySet).toEqual(new Set(["gluten"]));
  });
});
