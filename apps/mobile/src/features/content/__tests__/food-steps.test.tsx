// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({
  alert: vi.fn(),
  picker: {} as Record<string, unknown>,
  pick: vi.fn(),
  type: vi.fn(),
}));

vi.mock("react-native", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).reactNative(held.alert)
);
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("react-intl", () => ({ useIntl: () => ({ locale: "en" }) }));
vi.mock("@/hooks/use-cancel-button", () => ({
  useCancelButton: () => ({ text: "cancel", style: "cancel" }),
}));
vi.mock("@/lib/i18n/use-text", async () => ({
  useText: (await import("../../../../__tests__/mocks/content-ui")).echoText,
}));
vi.mock("@/components/sheet", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).sheet()
);
vi.mock("@/components/sheet-input", async () => ({
  SheetInput: (await import("../../../../__tests__/mocks/content-ui")).kit.sheetInput,
}));
vi.mock("@/components/pill-button", async () => ({
  PillButton: (await import("../../../../__tests__/mocks/content-ui")).kit.button,
}));
vi.mock("@/components/icon-button", () => ({
  IconButton: ({ testID, onPress }: { testID: string; onPress: () => void }) => (
    <button data-testid={testID} onClick={onPress} />
  ),
}));
vi.mock("@/components/slice-row", () => ({ SliceHairline: () => null }));
vi.mock("@/components/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardRow: ({
    label,
    testID,
    onPress,
  }: {
    label: string;
    testID?: string;
    onPress?: () => void;
  }) => (
    <button data-testid={testID} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("@norish/shared-react/ingredients", async (importActual) => ({
  ...(await importActual<object>()),
  useIngredientSpellingsQuery: () => undefined,
  useIngredientPicker: () => ({
    term: "",
    picked: null,
    options: [{ id: "s1", name: "Sauces" }],
    hint: null,
    type: held.type,
    pick: held.pick,
    ...held.picker,
  }),
}));

const { FoodSpellingsStep } = await import("../components/food-spellings-step");
const { FoodPickerStep } = await import("../components/food-picker-step");

const item = {
  id: "soy",
  name: "Soy sauce",
  hiddenSpellings: 0,
  aliases: [
    { id: "a1", text: "sojasaus", canRemove: true },
    { id: "a2", text: "shoyu", canRemove: false },
  ],
};
const draftOf = (over: Record<string, unknown> = {}) =>
  ({
    alias: "",
    setAlias: vi.fn(),
    stageAlias: vi.fn(),
    added: ["ketjap"],
    unstage: vi.fn(),
    removed: new Set<string>(),
    toggleRemoval: vi.fn(),
    setRelocation: vi.fn(),
    hiddenSpellings: 0,
    ...over,
  }) as never;

describe("FoodSpellingsStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a page with Back to the food, and lists the spellings with the staged ones", () => {
    const onBack = vi.fn();

    render(<FoodSpellingsStep draft={draftOf()} item={item as never} onBack={onBack} />);
    expect(screen.getByTestId("food-spellings-sheet").getAttribute("data-back")).toBe("yes");
    fireEvent.click(screen.getByTestId("sheet-back"));
    expect(onBack).toHaveBeenCalled();
    for (const name of ["sojasaus", "shoyu", "ketjap"]) {
      expect(screen.getByTestId(`food-spelling-${name}`)).toBeTruthy();
    }
  });

  it("asks whether a removed spelling names no food, and stages its removal either way", () => {
    const draft = draftOf();

    render(<FoodSpellingsStep draft={draft} item={item as never} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("food-spelling-remove-sojasaus"));

    const buttons = held.alert.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];

    buttons[1]?.onPress?.();
    buttons[2]?.onPress?.();
    expect((draft as { toggleRemoval: ReturnType<typeof vi.fn> }).toggleRemoval.mock.calls).toEqual(
      [
        [item.aliases[0], false],
        [item.aliases[0], true],
      ]
    );
  });

  it("moves a spelling the reader may edit, unstages a typed one, and gives a seeded one no minus", () => {
    const draft = draftOf();

    render(<FoodSpellingsStep draft={draft} item={item as never} onBack={vi.fn()} />);
    expect(screen.queryByTestId("food-spelling-remove-shoyu")).toBeNull();
    fireEvent.click(screen.getByTestId("food-spelling-remove-ketjap"));
    expect((draft as { unstage: ReturnType<typeof vi.fn> }).unstage).toHaveBeenCalledWith("ketjap");
  });

  it("types a spelling into the draft from the header's plus", () => {
    const draft = draftOf();

    render(<FoodSpellingsStep draft={draft} item={item as never} onBack={vi.fn()} />);
    expect(screen.queryByTestId("food-spelling-input")).toBeNull();
    fireEvent.click(screen.getByTestId("sheet-secondary-settings.ingredients.addAlias"));
    fireEvent.change(screen.getByTestId("food-spelling-input"), { target: { value: "x" } });
    expect((draft as { setAlias: ReturnType<typeof vi.fn> }).setAlias).toHaveBeenCalledWith("x");
  });
});

describe("FoodPickerStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies a pick only once a food is picked", () => {
    const onConfirm = vi.fn();
    const relocation = { kind: "merge" } as const;
    const first = render(
      <FoodPickerStep
        ingredient={{ id: "soy", name: "Soy" }}
        relocation={relocation}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("food-picker-option"));
    expect(held.pick).toHaveBeenCalledWith({ id: "s1", name: "Sauces" });
    first.unmount();
  });

  it("offers a new ingredient for a spelling's move", () => {
    const onConfirm = vi.fn();
    const relocation = { kind: "move", aliasId: "a1", text: "sojasaus" } as const;

    render(
      <FoodPickerStep
        ingredient={{ id: "soy", name: "Soy" }}
        relocation={relocation}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByTestId("food-picker-new"));
    expect(onConfirm).toHaveBeenCalledWith(relocation, { id: null });
  });

  it("says why the list is empty", () => {
    held.picker = { options: [], hint: "searching" };
    render(
      <FoodPickerStep
        ingredient={{ id: "soy", name: "Soy" }}
        relocation={{ kind: "parent" }}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("settings.ingredients.pickerSearching")).toBeTruthy();
    held.picker = {};
  });
});
