import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useIngredientAdd } from "../use-ingredient-add";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const food = (id: string, name: string) => ({ id, name });

afterEach(resetTRPCFake);

function setUp(answer: unknown = { ingredient: food("9", "Sesame paste"), created: true }) {
  const added: unknown[] = [];

  serveTRPC(async (path, input) => {
    if (path === "ingredients.list") {
      const search = (input as { search: string }).search.toLowerCase();

      return {
        items: [food("1", "Sesame oil"), food("2", "Sesame seeds")].filter((item) =>
          item.name.toLowerCase().includes(search)
        ),
        nextCursor: null,
      };
    }

    added.push(input);

    return answer;
  });

  const hook = renderHook(() => useIngredientAdd("en"), {
    wrapper: createTestWrapper(createTestQueryClient(), fakePlatformAdapter()),
  });

  return { ...hook, added };
}

describe("useIngredientAdd", () => {
  it("shows the foods the name finds once typing settles, and offers Add for a name no food has", async () => {
    const { result } = setUp();

    act(() => result.current.setTyped("sesame "));
    expect(result.current.canAdd).toBe(false);
    await waitFor(() =>
      expect(result.current.matches.map((m) => m.name)).toEqual(["Sesame oil", "Sesame seeds"])
    );
    expect(result.current.canAdd).toBe(true);
  });

  it("offers no Add for the name of a food the catalogue has, whatever the case", async () => {
    const { result } = setUp();

    act(() => result.current.setTyped("SESAME OIL"));
    await waitFor(() => expect(result.current.exact?.id).toBe("1"));
    expect(result.current.canAdd).toBe(false);
  });

  it("adds through ingredients.add and answers the food and whether it was made", async () => {
    const { result, added } = setUp();

    act(() => result.current.setTyped("Sesame paste"));
    await waitFor(() => expect(result.current.canAdd).toBe(false));
    await waitFor(() => expect(result.current.matches).toEqual([]));
    await waitFor(() => expect(result.current.canAdd).toBe(true));

    let answer: Awaited<ReturnType<typeof result.current.add>> = null;

    await act(async () => {
      answer = await result.current.add();
    });
    expect(added).toEqual([{ name: "Sesame paste", locale: "en" }]);
    expect(answer).toMatchObject({ created: true, ingredient: { id: "9" } });
  });

  it("refuses a name over the server's bound", () => {
    const { result } = setUp();

    act(() => result.current.setTyped("x".repeat(301)));
    expect(result.current.tooLong).toBe(true);
    expect(result.current.canAdd).toBe(false);
  });
});
