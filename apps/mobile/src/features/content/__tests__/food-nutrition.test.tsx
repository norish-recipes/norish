// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  nutrition: { nutrition: null, measure: null } as Record<string, unknown>,
  draft: {} as Record<string, unknown>,
  set: vi.fn(),
  save: vi.fn(),
  removeAll: vi.fn(),
  icons: { upload: vi.fn(), generate: vi.fn(), isPending: false },
  canDrawImages: true,
  pickFile: vi.fn(),
  offline: false,
}));

vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: held.offline }),
}));
vi.mock("@/components/server-image", () => ({ ServerImage: () => <i data-testid="picture" /> }));
vi.mock("@/hooks/use-photo-source-sheet", () => ({
  usePhotoSourceSheet: () => (_options: unknown, onPicked: (assets: { uri: string }[]) => void) =>
    onPicked([{ uri: "file:///icon.png" }]),
}));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(public uri: string) {}
  },
}));
vi.mock("@/components/card", () => ({
  Card: ({ children, testID }: { children: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  CardRow: ({
    label,
    hint,
    value,
    testID,
    onPress,
  }: {
    label: string;
    hint?: string;
    value?: string;
    testID?: string;
    onPress?: () => void;
  }) => (
    <button data-testid={testID} onClick={onPress}>
      {label}|{value}|{hint}
    </button>
  ),
}));
vi.mock("@norish/shared-react/reader", () => ({
  usePermissions: (select: (permissions: { canDrawImages: boolean }) => unknown) =>
    select({ canDrawImages: held.canDrawImages }),
  useHiddenItemVisibility: () => ({ showIngredientIcons: true }),
}));
vi.mock("@norish/shared-react/ingredients", async (importActual) => ({
  ...(await importActual<object>()),
  useIngredientNutritionQuery: () => held.nutrition,
  useIngredientIconMutations: () => held.icons,
  useDatasetFoodSearch: () => ({ options: [], hint: "hint" }),
  useNutritionDraft: () => ({
    spoon: "teaspoon",
    draft: {
      numbers: { mode: "label", food: null, typed: ["1", "2", "3", "4"] },
      pieceWeight: { mode: "sources", food: null, typed: [] },
    },
    facts: ["numbers", "pieceWeight"],
    corrected: true,
    complete: true,
    canSave: true,
    overHundred: [],
    set: held.set,
    save: held.save,
    removeAll: held.removeAll,
    ...held.draft,
  }),
}));

const { FoodNutritionStep } = await import("../components/food-nutrition-step");
const { NutritionCorrectionStep } = await import("../components/nutrition-correction-step");
const { FoodIconField } = await import("../components/food-icon-field");

const fact = <T,>(value: T) => ({ value, source: { kind: "household" }, borrowedFrom: null });

describe("FoodNutritionStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.offline = false;
    held.nutrition = { nutrition: null, measure: null };
  });

  it("says Norish knows nothing yet, and opens the correction", () => {
    const onCorrect = vi.fn();

    render(<FoodNutritionStep ingredientId="soy" onBack={vi.fn()} onCorrect={onCorrect} />);
    expect(screen.getByTestId("food-nutrition-none")).toBeTruthy();
    fireEvent.click(screen.getByTestId("sheet-confirm"));
    expect(onCorrect).toHaveBeenCalledWith(false);
  });

  it("cannot open the correction offline", () => {
    held.offline = true;
    render(<FoodNutritionStep ingredientId="soy" onBack={vi.fn()} onCorrect={vi.fn()} />);
    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists the numbers with their source, and asks for a spoon's weight where none is known", () => {
    const onCorrect = vi.fn();

    held.nutrition = {
      nutrition: {
        numbers: fact({ kcal: 53, fat: 0, carbs: 5, protein: 8 }),
        pieceWeight: null,
        density: null,
      },
      measure: "teaspoon",
    };
    render(<FoodNutritionStep ingredientId="soy" onBack={vi.fn()} onCorrect={onCorrect} />);
    expect(screen.getByTestId("food-nutrition-facts").textContent).toContain('"value":"53"');
    expect(screen.getByTestId("food-nutrition-facts").textContent).toContain("source.household");
    fireEvent.click(screen.getByTestId("food-nutrition-spoon"));
    expect(onCorrect).toHaveBeenCalledWith(true);
  });
});

describe("NutritionCorrectionStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.offline = false;
  });

  const open = () =>
    render(
      <NutritionCorrectionStep
        askSpoon={false}
        current={null}
        ingredientId="soy"
        measure={null}
        name="Soy"
        onClose={vi.fn()}
      />
    );

  it("edits each fact's mode and typed numbers, saves, and removes the household's correction", () => {
    open();
    fireEvent.click(screen.getByTestId("nutrition-correction-pieceWeight-food"));
    expect(held.set).toHaveBeenCalledWith("pieceWeight", { mode: "food" });
    fireEvent.change(screen.getByTestId("nutrition-correction-fat"), { target: { value: "9" } });
    expect(held.set).toHaveBeenCalledWith("numbers", { typed: ["1", "9", "3", "4"] });
    fireEvent.click(screen.getByTestId("sheet-confirm"));
    expect(held.save).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("sheet-secondary-settings.ingredients.nutrition.remove"));
    expect(held.removeAll).toHaveBeenCalled();
  });

  it("cannot Save or Remove offline, and says so", () => {
    held.offline = true;
    open();
    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(
      (
        screen.getByTestId(
          "sheet-secondary-settings.ingredients.nutrition.remove"
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText("settings.ingredients.offline")).toBeTruthy();
  });

  it("keeps each label field titled once it holds a value", () => {
    open();
    expect(screen.getByText("settings.ingredients.nutrition.label.fat")).toBeTruthy();
    expect(screen.queryByText("settings.ingredients.nutrition.overHundred")).toBeNull();
  });

  it("says a mass per 100 g above 100 g is refused", () => {
    held.draft = { canSave: false, overHundred: ["numbers"] };
    open();
    expect(screen.getByText("settings.ingredients.nutrition.overHundred")).toBeTruthy();
    held.draft = {};
  });

  it("cannot save an incomplete draft, and has no Remove where nothing is corrected", () => {
    held.draft = { canSave: false, corrected: false };
    open();
    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.queryByTestId("sheet-secondary-settings.ingredients.nutrition.remove")
    ).toBeNull();
    held.draft = {};
  });
});

describe("FoodIconField", () => {
  const item = { id: "soy", canEdit: true } as never;
  const icons = { shown: "/i.png", hasOwn: true, remove: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    held.offline = false;
    held.canDrawImages = true;
    held.icons.isPending = false;
  });

  it("makes an uploaded or generated icon part of the draft", async () => {
    const onDraftChange = vi.fn();

    held.icons.upload.mockResolvedValue({ file: "f1", address: "/a1.png" });
    held.icons.generate.mockResolvedValue({ file: "f2", address: "/a2.png" });
    render(
      <FoodIconField icons={icons} item={item} onDraftChange={onDraftChange}>
        <i data-testid="name" />
      </FoodIconField>
    );
    const column = screen.getByTestId("name").parentElement;

    // The pills sit under the name, in its column, not under the picture.
    expect(column?.contains(screen.getByTestId("food-icon-upload"))).toBe(true);
    expect(column?.contains(screen.getByTestId("food-icon"))).toBe(false);
    fireEvent.click(screen.getByTestId("food-icon-upload"));
    await vi.waitFor(() =>
      expect(onDraftChange).toHaveBeenCalledWith({ file: "f1", address: "/a1.png" })
    );
    fireEvent.click(screen.getByTestId("food-icon-generate"));
    await vi.waitFor(() =>
      expect(onDraftChange).toHaveBeenCalledWith({ file: "f2", address: "/a2.png" })
    );
    fireEvent.click(screen.getByTestId("food-icon-remove"));
    expect(icons.remove).toHaveBeenCalled();
  });

  it("cannot upload, generate or remove an icon offline", () => {
    held.offline = true;
    render(
      <FoodIconField icons={icons} item={item} onDraftChange={vi.fn()}>
        <i data-testid="name" />
      </FoodIconField>
    );
    for (const id of ["food-icon-upload", "food-icon-generate", "food-icon-remove"]) {
      expect((screen.getByTestId(id) as HTMLButtonElement).disabled, id).toBe(true);
    }
  });

  it("offers Generate only where the instance can draw, and Remove only for the food's own", () => {
    held.canDrawImages = false;
    render(
      <FoodIconField icons={{ ...icons, hasOwn: false }} item={item} onDraftChange={vi.fn()}>
        <i data-testid="name" />
      </FoodIconField>
    );
    expect(screen.queryByTestId("food-icon-generate")).toBeNull();
    expect(screen.queryByTestId("food-icon-remove")).toBeNull();
  });

  it("shows the icon and name, with no pills, for a food the reader may not edit", () => {
    render(
      <FoodIconField
        icons={icons}
        item={{ id: "soy", canEdit: false } as never}
        onDraftChange={vi.fn()}
      >
        <i data-testid="name" />
      </FoodIconField>
    );
    expect(screen.queryByTestId("food-icon-upload")).toBeNull();
    expect(screen.getByTestId("name")).toBeTruthy();
    expect(screen.getByTestId("food-icon")).toBeTruthy();
  });
});
