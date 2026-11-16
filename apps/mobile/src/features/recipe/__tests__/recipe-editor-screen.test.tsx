// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

const state = vi.hoisted(() => ({
  payload: null as Record<string, unknown> | null,
  dirty: true,
  create: vi.fn(),
  update: vi.fn(),
  back: vi.fn(),
  dismissTo: vi.fn(),
  alert: vi.fn(),
  preventRemove: undefined as
    { prevent: boolean; callback: (event: { repeat: () => void }) => void } | undefined,
}));

vi.mock("react-native", () => ({
  Alert: { alert: state.alert },
  Keyboard: {
    isVisible: () => false,
    addListener: () => ({ remove: () => {} }),
    metrics: () => null,
  },
  KeyboardAvoidingView: ({ children }: { children: ReactNode }) => children,
  Text: () => null,
  View: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({
  Skeleton: () => null,
  useThemeColor: (names: readonly string[]) => names.map(() => "#000"),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ back: state.back, dismissTo: state.dismissTo }),
}));
vi.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (prevent: boolean, callback: (event: { repeat: () => void }) => void) => {
    state.preventRemove = { prevent, callback };
  },
}));
vi.mock("@/components/drag-list/drag-list", () => ({
  DragScrollView: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/modal-header", () => import("../../../../__tests__/mocks/modal-header"));
vi.mock("@/hooks/use-category-label", () => ({ useCategoryLabel: () => (name: string) => name }));
vi.mock("../components/tint", () => ({
  SectionCard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/editor/detail-cards", () => ({
  NutritionCard: () => null,
  ServingsAndTimeCard: () => null,
  TagsAndCategoriesCard: () => null,
}));
vi.mock("../components/editor/editor-parts", () => ({
  EditorField: ({ children }: { children: ReactNode }) => children,
  EditorInput: () => null,
  TitleWithHint: () => null,
}));
vi.mock("../components/editor/ingredient-rows", () => ({ IngredientRows: () => null }));
vi.mock("../components/editor/media-strip", () => ({ MediaStrip: () => null }));
vi.mock("../components/editor/provenance-cards", () => ({
  ProvenanceCard: () => null,
  SourceCard: () => null,
}));
vi.mock("../components/editor/step-rows", () => ({ StepRows: () => null }));
vi.mock("../hooks/use-editor-uploads", () => ({
  useEditorUploads: () => ({ pendingFor: () => [] }),
}));
vi.mock("@norish/shared-react/config", () => ({ useIngredientsSubscription: () => undefined }));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipeId: (_mode: string, existing?: string) => ({ recipeId: existing ?? "new-id" }),
  useRecipeMutationErrorToast: () => undefined,
  useRecipesMutations: () => ({ createRecipe: state.create, updateRecipe: state.update }),
  useRecipeEditorForm: () => ({
    form: { name: "Soup", ingredients: [], steps: [], systemUsed: "metric", media: [] },
    set: vi.fn(),
    errors: {},
    submit: () => state.payload,
    failSubmit: vi.fn(),
    hasUnsavedChanges: state.dirty,
    moveLines: vi.fn(),
    changeSystem: vi.fn(),
    categoryOptions: [],
    toggleCategory: vi.fn(),
    addCategory: vi.fn(),
  }),
}));

const { RecipeEditorScreen } = await import("@/features/recipe/screens/recipe-editor-screen");

const save = () => fireEvent.click(screen.getByTestId("recipe-editor-confirm"));

const stored = { id: "recipe-1", version: 4 } as FullRecipeDTO;

describe("RecipeEditorScreen", () => {
  beforeEach(() => {
    state.payload = { name: "Soup" };
    state.dirty = true;
    for (const mock of [state.create, state.update, state.back, state.dismissTo, state.alert]) {
      mock.mockReset();
    }
  });

  it("saves nothing while the form is invalid", () => {
    state.payload = null;
    render(<RecipeEditorScreen mode="create" />);
    save();

    expect(state.create).not.toHaveBeenCalled();
    expect(state.dismissTo).not.toHaveBeenCalled();
  });

  it("creates under the minted id and opens the recipe", () => {
    render(<RecipeEditorScreen mode="create" />);
    save();

    expect(state.create).toHaveBeenCalledWith({ name: "Soup", id: "new-id" });
    expect(state.dismissTo).toHaveBeenCalledWith({
      pathname: "/recipe/[id]",
      params: { id: "new-id" },
    });
  });

  it("updates at the version the editor opened on and goes back", () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    save();

    expect(state.update).toHaveBeenCalledWith("recipe-1", { name: "Soup", version: 4 });
    expect(state.back).toHaveBeenCalledOnce();
  });

  it("asks before leaving with changes and leaves only on Discard", () => {
    render(<RecipeEditorScreen mode="create" />);
    const repeat = vi.fn();

    expect(state.preventRemove?.prevent).toBe(true);
    state.preventRemove?.callback({ repeat });

    const [title, , buttons] = state.alert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];

    expect(title).toBe("recipes.editor.discardTitle");
    expect(repeat).not.toHaveBeenCalled();
    buttons.find((button) => button.text === "recipes.editor.discard")?.onPress?.();
    expect(repeat).toHaveBeenCalledOnce();
  });

  it("lets its own save leave without asking", () => {
    render(<RecipeEditorScreen mode="create" />);
    save();
    const repeat = vi.fn();

    state.preventRemove?.callback({ repeat });

    expect(state.alert).not.toHaveBeenCalled();
    expect(repeat).toHaveBeenCalledOnce();
  });
});
