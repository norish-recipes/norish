// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  canCreate: false,
  create: vi.fn(),
  back: vi.fn(),
  params: {} as { recipeId?: string },
  opened: vi.fn(),
  action: undefined as { onPress?: () => void } | undefined,
}));

vi.mock("react-native", () => ({ View: () => null }));
vi.mock("heroui-native", () => ({ Input: () => null, TextField: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/hooks/use-focus-on-mount", () => ({ useFocusOnMount: () => ({ current: null }) }));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => state.params,
  useRouter: () => ({ back: state.back }),
}));
vi.mock("../components/recipe-pick", () => ({
  SearchRecipes: () => null,
  recipePickList: () => ({}),
}));
vi.mock("../components/pick-sheet", () => ({
  PickSheet: ({ action }: { action: { onPress?: () => void } }) => {
    state.action = action;

    return null;
  },
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useNewCookbook: (initial: string[]) => {
    state.opened(initial);

    return {
      title: "Soups",
      setTitle: vi.fn(),
      canCreate: state.canCreate,
      create: state.create,
      input: "",
      setInput: vi.fn(),
      recipes: [],
      isLoading: false,
      loadMore: vi.fn(),
      selected: [],
      toggle: vi.fn(),
    };
  },
}));

const { NewCookbookScreen } = await import("@/features/recipes/screens/new-cookbook-screen");

describe("New cookbook", () => {
  beforeEach(() => {
    state.canCreate = false;
    state.params = {};
    state.create.mockReset();
    state.back.mockReset();
    state.opened.mockReset();
    state.action = undefined;
  });

  it("keeps Create off until the cookbook has a name", () => {
    render(<NewCookbookScreen />);

    expect(state.action?.onPress).toBeUndefined();
  });

  it("creates the cookbook and closes the sheet", () => {
    state.canCreate = true;
    render(<NewCookbookScreen />);
    state.action?.onPress?.();

    expect(state.create).toHaveBeenCalledOnce();
    expect(state.back).toHaveBeenCalledOnce();
  });

  it("starts empty from the Cookbooks lens", () => {
    render(<NewCookbookScreen />);

    expect(state.opened).toHaveBeenCalledWith([]);
  });

  it("starts with the card's recipe ticked", () => {
    state.params = { recipeId: "r9" };
    render(<NewCookbookScreen />);

    expect(state.opened).toHaveBeenCalledWith(["r9"]);
  });
});
