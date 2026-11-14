// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  canCreate: false,
  create: vi.fn(),
  back: vi.fn(),
  action: undefined as { onPress?: () => void } | undefined,
}));

vi.mock("react-native", () => ({ View: () => null }));
vi.mock("heroui-native", () => ({ Input: () => null, TextField: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/hooks/use-focus-on-mount", () => ({ useFocusOnMount: () => ({ current: null }) }));
vi.mock("expo-router", () => ({
  useRouter: () => ({ back: state.back }),
}));
vi.mock("../components/recipe-pick", () => ({
  RecipePickSheet: ({ action }: { action: { onPress?: () => void } }) => {
    state.action = action;

    return null;
  },
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useNewCookbook: () => {
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
    state.create.mockReset();
    state.back.mockReset();
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
});
