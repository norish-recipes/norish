// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const state = vi.hoisted(() => ({
  recipe: null as { servings: number } | null,
  hook: undefined as undefined | ((args: Record<string, unknown>) => void),
  mounted: [] as string[],
  foodsArgs: {} as Record<string, unknown>,
}));

vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipeQuery: () => ({ recipe: state.recipe }),
  useRecipeFoodsToBuy: (recipeId: string, original: number, initial: number) => {
    state.foodsArgs = { recipeId, original, initial };

    return { scaledIngredients: [], isLoading: false, linkedLoading: false };
  },
}));
vi.mock("@norish/shared-react/groceries", async () => {
  const { useEffect } = await import("react");

  return {
    useAddAtOnce: (args: Record<string, unknown>) => {
      useEffect(() => {
        state.mounted.push(String(state.foodsArgs.recipeId));
        state.hook?.(args);
      }, []);
    },
  };
});

const { AddAtOnceHost, useAddAtOnceStarter } =
  await import("@/features/recipes/components/add-at-once-host");

let start: (recipeId: string) => void;

function Starter() {
  start = useAddAtOnceStarter();

  return null;
}

const mount = () =>
  render(
    <AddAtOnceHost>
      <Starter />
    </AddAtOnceHost>
  );

describe("AddAtOnceHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.recipe = { servings: 4 };
    state.hook = undefined;
    state.mounted = [];
  });

  it("adds a planned recipe's lines at the recipe's own servings", () => {
    mount();
    act(() => start("r1"));

    expect(state.foodsArgs).toEqual({ recipeId: "r1", original: 4, initial: 4 });
    expect(state.mounted).toEqual(["r1"]);
  });

  it("waits for the recipe before reading the lines", () => {
    state.recipe = null;
    mount();
    act(() => start("r1"));

    expect(state.mounted).toEqual([]);
  });

  it("opens Add to groceries when the Pantry cannot be read, and not otherwise", () => {
    state.hook = (args) => {
      (args.onOpenChange as (open: boolean) => void)(false);
      expect(router.push).not.toHaveBeenCalled();
      (args.onOpenChange as (open: boolean) => void)(true);
    };
    mount();
    act(() => start("r1"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/add-to-groceries",
      params: { recipeId: "r1" },
    });
  });

  it("lets go of the recipe once decided, and starts again for the next", () => {
    state.hook = (args) => (args.onDone as () => void)();
    mount();
    act(() => start("r1"));
    act(() => start("r2"));

    expect(state.mounted).toEqual(["r1", "r2"]);
  });

  it("refuses to start outside the host", () => {
    expect(() => render(<Starter />)).toThrow("AddAtOnceHost");
  });
});
