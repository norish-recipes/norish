// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { alert } from "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  router: { back: vi.fn() },
  item: {} as Record<string, unknown> | null,
  draft: {} as Record<string, unknown>,
  save: vi.fn(),
  remove: vi.fn(),
  setRelocation: vi.fn(),
  markDistinct: vi.fn(),
  uses: undefined as unknown,
  offline: false,
  unsure: [] as unknown[],
}));

vi.mock("expo-router", () => ({
  useRouter: () => held.router,
  useLocalSearchParams: () => ({ id: "soy" }),
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: held.offline }),
}));
vi.mock("../components/food-icon-field", () => ({
  FoodIconField: ({ children }: { children: ReactNode }) => (
    <div>
      <i data-testid="icon" />
      {children}
    </div>
  ),
}));
vi.mock("../components/food-spellings-step", () => ({
  FoodSpellingsStep: ({ onBack }: { onBack: () => void }) => (
    <button data-testid="step-spellings" onClick={onBack} />
  ),
}));
vi.mock("../components/food-nutrition-step", () => ({
  FoodNutritionStep: ({ onCorrect }: { onCorrect: (askSpoon: boolean) => void }) => (
    <button data-testid="step-nutrition" onClick={() => onCorrect(true)} />
  ),
}));
vi.mock("../components/nutrition-correction-step", () => ({
  NutritionCorrectionStep: ({ askSpoon }: { askSpoon: boolean }) => (
    <i data-testid="step-correction" data-spoon={askSpoon} />
  ),
}));
vi.mock("../components/food-picker-step", () => ({
  FoodPickerStep: ({
    relocation,
    onConfirm,
  }: {
    relocation: { kind: string };
    onConfirm: (relocation: unknown, target: unknown) => void;
  }) => (
    <button
      data-kind={relocation.kind}
      data-testid="step-picker"
      onClick={() => onConfirm(relocation, { id: "x", name: "X" })}
    />
  ),
}));
vi.mock("@norish/shared-react/ingredients", async (importActual) => ({
  ...(await importActual<object>()),
  useIngredientQuery: () => held.item,
  useIngredientUsesQuery: () => ({ uses: held.uses }),
  useIngredientNutritionQuery: () => ({ nutrition: null, measure: null }),
  useAIChangeMutations: () => ({ keep: vi.fn(), undo: vi.fn() }),
  useAIChangesQuery: () => held.unsure,
  changeCopy: () => ({ key: "merge", values: {} }),
  useIngredientDraft: () => ({
    name: "Soy sauce",
    setName: vi.fn(),
    parent: null,
    setParent: vi.fn(),
    icons: { shown: null, hasOwn: false, remove: vi.fn() },
    setIcon: vi.fn(),
    spellingCount: 3,
    dirty: false,
    relocation: null,
    setRelocation: held.setRelocation,
    saveRelocation: vi.fn(),
    save: held.save,
    remove: held.remove,
    markDistinct: held.markDistinct,
    ...held.draft,
  }),
}));

const { IngredientScreen } = await import("../screens/ingredient-screen");

const food = (over: Record<string, unknown> = {}) => ({
  id: "soy",
  name: "Soy sauce",
  flagged: false,
  parent: null,
  canEdit: true,
  aliases: [],
  ...over,
});

describe("IngredientScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.item = food();
    held.draft = {};
    held.offline = false;
    held.unsure = [];
    held.uses = { counts: { recipeLines: 4, groceries: 0, pantry: 1 } };
    held.save.mockResolvedValue(true);
  });

  it("is a skeleton until the food is read", () => {
    held.item = null;
    render(<IngredientScreen />);
    expect(screen.getByTestId("skeleton")).toBeTruthy();
  });

  it("saves only a changed draft, and closes once it went through", async () => {
    const first = render(<IngredientScreen />);

    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
    first.unmount();
    held.draft = { dirty: true };
    render(<IngredientScreen />);
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.save).toHaveBeenCalled();
    expect(held.router.back).toHaveBeenCalled();
  });

  it("stays open when the save was refused", async () => {
    held.draft = { dirty: true };
    held.save.mockResolvedValue(false);
    render(<IngredientScreen />);
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.router.back).not.toHaveBeenCalled();
  });

  it("confirms a delete in the native alert with what it touches, then deletes", () => {
    render(<IngredientScreen />);
    fireEvent.click(screen.getByTestId("sheet-secondary-common.actions.delete"));

    const [title, body, buttons] = alert.mock.calls[0] as [
      string,
      string,
      { style?: string; onPress?: () => void }[],
    ];

    expect(title).toContain("deleteTitle");
    expect(body).toContain('deleteTouches.recipeLines{"count":4}');
    expect(body).toContain('deleteTouches.pantry{"count":1}');
    expect(body).not.toContain("deleteTouches.groceries");
    expect(buttons.map((button) => button.style)).toEqual(["cancel", "destructive"]);
    buttons[1]?.onPress?.();
    expect(held.remove).toHaveBeenCalled();
  });

  it("has no Delete, Merge or editable name for a food the reader may not edit", () => {
    held.item = food({ canEdit: false });
    render(<IngredientScreen />);
    expect(screen.queryByTestId("sheet-secondary-common.actions.delete")).toBeNull();
    expect(screen.queryByTestId("food-merge")).toBeNull();
    expect(screen.queryByTestId("food-name")).toBeNull();
  });

  it("opens the pickers for a merge and a parent, and the pages for spellings and nutrition", () => {
    render(<IngredientScreen />);
    fireEvent.click(screen.getByTestId("food-merge"));
    expect(held.setRelocation).toHaveBeenCalledWith({ kind: "merge" });
    fireEvent.click(screen.getByTestId("food-parent"));
    expect(held.setRelocation).toHaveBeenCalledWith({ kind: "parent" });
    fireEvent.click(screen.getByTestId("food-spellings"));
    expect(screen.getByTestId("step-spellings")).toBeTruthy();
    fireEvent.click(screen.getByTestId("step-spellings"));
    fireEvent.click(screen.getByTestId("food-nutrition"));
    fireEvent.click(screen.getByTestId("step-nutrition"));
    expect(screen.getByTestId("step-correction").getAttribute("data-spoon")).toBe("true");
  });

  it("shows no dash for a food with no parent", () => {
    render(<IngredientScreen />);
    expect(screen.getByTestId("food-parent").textContent).not.toContain("-");
  });

  it("draws the picker while a relocation is asked", () => {
    held.draft = { relocation: { kind: "parent" } };
    render(<IngredientScreen />);
    expect(screen.getByTestId("step-picker").getAttribute("data-kind")).toBe("parent");
  });

  it("keeps a flagged food distinct from its own switch, only where the reader may edit", () => {
    held.item = food({ flagged: true, flagReason: "similar" });
    render(<IngredientScreen />);
    expect(screen.getByTestId("food-flag").textContent).toContain("flagReasons.similar");
    expect(screen.getByLabelText("settings.ingredients.keepDistinct")).toBeTruthy();
    fireEvent.click(screen.getByTestId("food-keep-distinct"));
    expect(held.markDistinct).toHaveBeenCalled();
  });

  it("writes nothing offline: every write is off and the sheet says so", () => {
    held.offline = true;
    held.item = food({ flagged: true, flagReason: "similar" });
    held.draft = { dirty: true };
    held.unsure = [{ id: "c1", canAct: true }];
    render(<IngredientScreen />);

    const off = (id: string) => (screen.getByTestId(id) as HTMLButtonElement).disabled;

    expect(off("sheet-confirm")).toBe(true);
    expect(off("sheet-secondary-common.actions.delete")).toBe(true);
    expect(off("food-merge")).toBe(true);
    expect(off("food-keep-distinct")).toBe(true);
    expect(off("food-ai-change-keep-c1")).toBe(true);
    expect(off("food-ai-change-undo-c1")).toBe(true);
    expect(screen.getByText("settings.content.offline")).toBeTruthy();
  });

  it("is writable online, without the offline note", () => {
    held.item = food({ flagged: true, flagReason: "similar" });
    held.draft = { dirty: true };
    held.unsure = [{ id: "c1", canAct: true }];
    render(<IngredientScreen />);
    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("food-ai-change-keep-c1") as HTMLButtonElement).disabled).toBe(
      false
    );
    expect(screen.queryByText("settings.content.offline")).toBeNull();
  });
});
