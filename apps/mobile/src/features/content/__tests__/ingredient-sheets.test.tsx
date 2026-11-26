// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({
  router: { back: vi.fn(), replace: vi.fn(), push: vi.fn() },
  apply: vi.fn(),
  changes: [] as unknown[],
  mutations: { keep: vi.fn(), undo: vi.fn(), keepAll: vi.fn(), undoAll: vi.fn(), clear: vi.fn() },
  add: {} as Record<string, unknown>,
  doAdd: vi.fn(),
}));

vi.mock("react-native", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).reactNative(vi.fn())
);
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["#000"] }));
vi.mock("react-intl", () => ({ useIntl: () => ({ locale: "en" }) }));
vi.mock("@/lib/i18n/use-text", async () => ({
  useText: (await import("../../../../__tests__/mocks/content-ui")).echoText,
}));
vi.mock("expo-router", () => ({ useRouter: () => held.router }));
vi.mock("@/components/sheet", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).sheet()
);
vi.mock("@/components/sheet-input", async () => ({
  SheetInput: (await import("../../../../__tests__/mocks/content-ui")).kit.sheetInput,
}));
vi.mock("@/components/toggle-chip", async () => ({
  ToggleChip: (await import("../../../../__tests__/mocks/content-ui")).kit.button,
}));
vi.mock("@/components/switch", async () => ({
  Switch: (await import("../../../../__tests__/mocks/content-ui")).kit.button,
}));
vi.mock("@/components/empty-card", async () => ({
  EmptyCard: (await import("../../../../__tests__/mocks/content-ui")).kit.emptyCard,
}));
vi.mock("@/components/card-slice", () => ({
  CardSlice: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconSlots: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@norish/shared-react/ingredients", async (importActual) => {
  const actual = await importActual<typeof import("@norish/shared-react/ingredients")>();

  return {
    ...actual,
    useIngredientFiltersStore: (select: (state: unknown) => unknown) =>
      select({ filters: actual.DEFAULT_INGREDIENT_FILTERS, apply: held.apply }),
    useAIChangesQuery: () => held.changes,
    useAIChangeMutations: () => held.mutations,
    useIngredientIcons: () => undefined,
    useIngredientAdd: () => ({
      typed: "sesame paste",
      setTyped: vi.fn(),
      matches: [],
      tooLong: false,
      failed: false,
      offline: false,
      canAdd: true,
      add: held.doAdd,
      ...held.add,
    }),
  };
});

const { IngredientFiltersScreen } = await import("../screens/ingredient-filters-screen");
const { IngredientChangesScreen } = await import("../screens/ingredient-changes-screen");
const { IngredientAddScreen } = await import("../screens/ingredient-add-screen");
const { DEFAULT_INGREDIENT_FILTERS } = await import("@norish/shared-react/ingredients");

const change = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "plain-name",
  sure: false,
  kept: false,
  createdAt: new Date(0),
  ingredient: { id: `f-${id}`, name: `Food ${id}` },
  target: null,
  dropped: null,
  from: "Old",
  canAct: true,
  ...over,
});

describe("IngredientFiltersScreen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lands what was chosen with Apply, and the defaults with Reset", () => {
    render(<IngredientFiltersScreen />);
    fireEvent.click(screen.getByTestId("ingredients-flaggedOnly"));
    fireEvent.click(screen.getByTestId("ingredients-match-exact"));
    fireEvent.click(screen.getByTestId("sheet-confirm"));
    expect(held.apply).toHaveBeenCalledWith({
      ...DEFAULT_INGREDIENT_FILTERS,
      flaggedOnly: true,
      match: "exact",
    });
    expect(held.router.back).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("sheet-secondary-common.actions.reset"));
    expect(held.apply).toHaveBeenLastCalledWith(DEFAULT_INGREDIENT_FILTERS);
  });
});

describe("IngredientChangesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.changes = [change("a"), change("b"), change("c", { kept: true })];
  });

  it("says AI changed nothing", () => {
    held.changes = [];
    render(<IngredientChangesScreen />);
    expect(screen.getByTestId("ingredient-changes-empty")).toBeTruthy();
  });

  it("keeps or undoes one change, and opens the food it is listed under", () => {
    render(<IngredientChangesScreen />);
    fireEvent.click(screen.getByTestId("ingredient-change-keep-a"));
    expect(held.mutations.keep).toHaveBeenCalledWith(held.changes[0]);
    fireEvent.click(screen.getByTestId("ingredient-change-undo-b"));
    expect(held.mutations.undo).toHaveBeenCalledWith(held.changes[1]);
    // A settled change has no Keep.
    expect(screen.queryByTestId("ingredient-change-keep-c")).toBeNull();
    fireEvent.click(screen.getByTestId("ingredient-change-open-a"));
    expect(held.router.push).toHaveBeenCalledWith({
      pathname: "/settings/ingredient",
      params: { id: "f-a" },
    });
  });

  it("keeps or undoes every open change at once, and Clear stops listing the settled", () => {
    render(<IngredientChangesScreen />);
    fireEvent.click(screen.getByTestId("sheet-confirm"));
    expect(held.mutations.keepAll).toHaveBeenCalledWith([held.changes[0], held.changes[1]]);
    fireEvent.click(screen.getByTestId("sheet-secondary-settings.ingredients.changedByAI.undoAll"));
    expect(held.mutations.undoAll).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("sheet-secondary-settings.ingredients.changedByAI.clear"));
    expect(held.mutations.clear).toHaveBeenCalled();
    expect(held.router.back).not.toHaveBeenCalled();
  });

  it("closes on Clear when nothing is left to check", () => {
    held.changes = [change("c", { kept: true })];
    render(<IngredientChangesScreen />);
    fireEvent.click(screen.getByTestId("sheet-secondary-settings.ingredients.changedByAI.clear"));
    expect(held.router.back).toHaveBeenCalled();
  });
});

describe("IngredientAddScreen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds the name and opens the food it answers", async () => {
    held.doAdd.mockResolvedValue({ ingredient: { id: "n1" }, created: true });
    render(<IngredientAddScreen />);
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.router.replace).toHaveBeenCalledWith({
      pathname: "/settings/ingredient",
      params: { id: "n1" },
    });
  });

  it("offers no Add for a name the catalogue has, and says a name is too long or failed", () => {
    held.add = { canAdd: false, tooLong: true, failed: true };
    render(<IngredientAddScreen />);
    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/panel.tooLong/)).toBeTruthy();
    expect(screen.getByText("settings.content.panel.failed")).toBeTruthy();
  });
});
