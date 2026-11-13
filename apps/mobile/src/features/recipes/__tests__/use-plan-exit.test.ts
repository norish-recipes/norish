// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn() }));
const user = vi.hoisted(() => ({ current: {} as unknown }));
const addAtOnce = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("@/features/recipes/components/add-at-once-host", () => ({
  useAddAtOnceStarter: () => addAtOnce,
}));
vi.mock("@norish/shared-react/reader", () => ({ useReader: () => ({ user: user.current }) }));

const { usePlanExit } = await import("@/features/recipes/hooks/use-plan-exit");

function exit(afterPlanning?: string) {
  user.current = { preferences: afterPlanning ? { afterPlanning } : {} };

  return renderHook(() => usePlanExit()).result.current;
}

describe("usePlanExit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes for a note or a move, whatever the choice", () => {
    exit("openGroceries")();

    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("closes after a recipe when the choice is nothing", () => {
    exit("nothing")("r1");

    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("is replaced by Add to groceries for the recipe by default", () => {
    exit()("r1");

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/add-to-groceries",
      params: { recipeId: "r1" },
    });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("closes and puts the lines on the list at once when the choice says so", () => {
    exit("addGroceries")("r1");

    expect(router.back).toHaveBeenCalled();
    expect(addAtOnce).toHaveBeenCalledWith("r1");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("adds nothing at once for the other choices", () => {
    exit("openGroceries")("r1");
    exit("nothing")("r1");

    expect(addAtOnce).not.toHaveBeenCalled();
  });
});
