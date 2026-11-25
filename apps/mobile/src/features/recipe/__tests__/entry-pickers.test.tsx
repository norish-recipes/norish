// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = {
  testID?: string;
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean };
  children?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
};

const mocks = vi.hoisted(() => ({
  entries: [] as { id: string; name: string }[],
  created: vi.fn(),
  readFor: vi.fn(),
  offline: false,
  request: null as null | {
    choices: unknown[];
    list?: { kind: string; recipeId?: string };
    selected: string[];
    onChange: (keys: string[]) => void;
  },
  back: vi.fn(),
}));

vi.mock("react-native", () => ({
  View: ({ children, testID }: Props) => <div data-testid={testID}>{children}</div>,
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ testID, children, onPress, disabled, accessibilityLabel }: Props) => (
    <button
      aria-label={accessibilityLabel}
      data-testid={testID}
      disabled={disabled}
      type="button"
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    locale: "en",
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id} ${Object.values(values).join(" ")}` : id,
  }),
}));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/hint-button", () => ({ HintButton: () => null }));
vi.mock("@/components/servings-stepper", () => ({ ServingsStepper: () => null }));
vi.mock("@/components/checkmark", () => ({ Checkmark: () => <span>ticked</span> }));
vi.mock("@/components/slice-row", () => ({ SliceHairline: () => null, sliceRowClass: () => "" }));
vi.mock("@/components/toggle-chip", () => ({
  ToggleChip: ({ label, onPress, disabled, testID }: Props & { label: string }) => (
    <button disabled={disabled} data-testid={testID} type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("@/components/sheet", () => ({
  Sheet: ({ children }: Props) => <div>{children}</div>,
  SheetList: ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => ReactNode;
    ListHeaderComponent: ReactNode;
  }) => (
    <div>
      {ListHeaderComponent}
      {data.map((item, index) => (
        <div key={index}>{renderItem({ item, index })}</div>
      ))}
    </div>
  ),
}));
vi.mock("@/components/sheet-search-field", () => ({
  SheetSearchField: ({
    testID,
    value,
    onChange,
  }: {
    testID: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input data-testid={testID} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mocks.back, push: vi.fn() }),
  useLocalSearchParams: () => ({ name: "editor-cuisine", title: "Cuisines", multiple: "1" }),
}));
vi.mock("../components/tint", () => ({
  SectionCard: ({ children }: Props) => <div>{children}</div>,
}));
vi.mock("../components/editor/editor-parts", () => ({
  EditorField: ({ children }: Props) => <div>{children}</div>,
  EditorInput: ({
    testID,
    value,
    onChangeText,
    onSubmitEditing,
    accessibilityLabel,
  }: {
    testID?: string;
    value?: string;
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
  }) => (
    <input
      aria-label={accessibilityLabel}
      data-testid={testID}
      value={value ?? ""}
      onChange={(event) => onChangeText?.(event.target.value)}
      onKeyDown={(event) => event.key === "Enter" && onSubmitEditing?.()}
    />
  ),
}));
vi.mock("../components/editor/choice-request", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  takeChoice: () => mocks.request,
  requestChoice: (slot: typeof mocks.request) => {
    mocks.request = slot;
  },
}));

// The shared hook is tested in shared-react; here it is the list and a create that answers.
vi.mock("@norish/shared-react/lists", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/shared-react/lists")>();

  return {
    ...actual,
    useListEntries: (kind: string, recipeId?: string) => {
      mocks.readFor(kind, recipeId);

      return { entries: mocks.entries, isLoading: false };
    },
    useEntryPicker: ({
      kind,
      recipeId,
      typed,
      isSelected,
      onSelect,
    }: Parameters<typeof actual.useEntryPicker>[0]) => {
      const offer = actual.createOffer(kind, mocks.entries, typed);

      mocks.readFor(kind, recipeId);

      return {
        isLoading: false,
        matches: actual.matchEntries(
          kind,
          mocks.entries.filter((entry) => !isSelected(entry)),
          typed
        ),
        offer,
        isOffline: mocks.offline,
        createDisabled: mocks.offline,
        isCreating: false,
        createFailed: false,
        createAndSelect: async () => {
          if (offer.kind !== "create" || mocks.offline) return;
          mocks.created(offer.name);
          onSelect({ id: `new-${offer.name}`, name: offer.name });
        },
      };
    },
  };
});

const { TagsAndCategoriesCard } = await import("../components/editor/detail-cards");
const { ProvenanceCard } = await import("../components/editor/provenance-cards");
const { EditorChoiceScreen } = await import("../screens/editor-choice-screen");

const RECIPE = "55555555-5555-4555-8555-555555555555";
const form = (over: object = {}) => ({ tags: [], categories: [], ...over }) as never;

beforeEach(() => {
  mocks.entries = [
    { id: "1", name: "BBQ" },
    { id: "2", name: "Café" },
  ];
  mocks.created.mockClear();
  mocks.readFor.mockClear();
  mocks.back.mockClear();
  mocks.offline = false;
  mocks.request = null;
});

function renderCard(set = vi.fn(), onAddCategory = vi.fn(), over: object = {}) {
  render(
    <TagsAndCategoriesCard
      categoryLabel={(name) => name}
      categoryOptions={[]}
      form={form(over)}
      recipeId={RECIPE}
      set={set}
      onAddCategory={onAddCategory}
      onToggleCategory={vi.fn()}
    />
  );

  return { set, onAddCategory };
}

describe("the Tag picker", () => {
  it("picks an existing Tag typed in another case, and offers no Create row for it", () => {
    const { set } = renderCard();

    fireEvent.change(screen.getByTestId("editor-tag-input"), { target: { value: "bbq" } });

    expect(screen.queryByTestId("editor-tag-input-create")).toBeNull();
    fireEvent.click(screen.getByTestId("editor-tag-input-match-1"));

    expect(set).toHaveBeenCalledWith("tags", ["BBQ"]);
    expect(mocks.created).not.toHaveBeenCalled();
  });

  it("creates a new Tag from its Create row, then selects what was made", () => {
    const { set } = renderCard();

    fireEvent.change(screen.getByTestId("editor-tag-input"), { target: { value: "Grill" } });
    fireEvent.click(screen.getByRole("button", { name: "recipes.picker.create Grill" }));

    expect(mocks.created).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("tags", ["Grill"]);
    expect((screen.getByTestId("editor-tag-input") as HTMLInputElement).value).toBe("");
  });

  it("creates nothing by typing and returning: it picks only an entry named in full", () => {
    const { set } = renderCard();
    const field = screen.getByTestId("editor-tag-input");

    fireEvent.change(field, { target: { value: "Grill" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.created).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "cafe" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(set).toHaveBeenCalledWith("tags", ["Café"]);
  });

  it("offers Create offline but disabled, with its own wording", () => {
    mocks.offline = true;
    renderCard();

    fireEvent.change(screen.getByTestId("editor-tag-input"), { target: { value: "Grill" } });
    const create = screen.getByRole("button", { name: "recipes.picker.createOffline Grill" });

    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(create);
    expect(mocks.created).not.toHaveBeenCalled();
  });

  it("reads the list of the recipe being edited", () => {
    renderCard();

    expect(mocks.readFor).toHaveBeenCalledWith("tag", RECIPE);
  });
});

describe("the Category picker", () => {
  it("picks an existing Category by a different case and creates a new one explicitly", () => {
    mocks.entries = [{ id: "d", name: "Dinner" }];
    const { onAddCategory } = renderCard();
    const field = screen.getByTestId("editor-add-category");

    fireEvent.change(field, { target: { value: "DINNER" } });
    fireEvent.click(screen.getByTestId("editor-add-category-match-d"));
    expect(onAddCategory).toHaveBeenLastCalledWith("Dinner");

    fireEvent.change(field, { target: { value: "Brunch" } });
    fireEvent.click(screen.getByRole("button", { name: "recipes.picker.create Brunch" }));
    expect(onAddCategory).toHaveBeenLastCalledWith("Brunch");
    expect(mocks.created).toHaveBeenCalledTimes(1);
  });

  it("does not offer a name over 40 characters, and says why", () => {
    renderCard();

    fireEvent.change(screen.getByTestId("editor-add-category"), {
      target: { value: "x".repeat(41) },
    });

    expect(screen.queryByTestId("editor-add-category-create")).toBeNull();
    expect(screen.getByText("recipes.picker.tooLong 40")).toBeTruthy();
  });
});

describe("the Cuisine picker", () => {
  const value = {
    originCountry: null,
    originCountryName: null,
    originRegion: "",
    provenanceNote: "",
    cuisineIds: ["old-id"],
  };

  it("names a carried Cuisine the list does not offer, never by its id", () => {
    render(
      <ProvenanceCard
        carriedCuisines={[{ id: "old-id", name: "Old household's" }]}
        recipeId={RECIPE}
        value={value}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "recipes.editor.removeNamed Old household's" })
    ).toBeTruthy();
    expect(mocks.readFor).toHaveBeenCalledWith("cuisine", RECIPE);
  });

  it("opens the list sheet over the recipe's household's Cuisines", () => {
    render(<ProvenanceCard recipeId={RECIPE} value={value} onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("editor-add-cuisine"));

    expect(mocks.request?.list).toEqual({ kind: "cuisine", recipeId: RECIPE });
  });

  function openSheet(selected: string[] = []) {
    const onChange = vi.fn();

    mocks.request = {
      choices: [],
      list: { kind: "cuisine", recipeId: RECIPE },
      selected,
      onChange,
    };
    render(<EditorChoiceScreen />);

    return onChange;
  }

  it("ticks an existing Cuisine found by a different case, creating nothing", () => {
    mocks.entries = [{ id: "thai", name: "Thai" }];
    const onChange = openSheet();

    fireEvent.change(screen.getByTestId("editor-cuisine-search"), { target: { value: "THAI" } });
    expect(screen.queryByTestId("editor-cuisine-create")).toBeNull();
    fireEvent.click(screen.getByTestId("editor-cuisine-thai"));

    expect(onChange).toHaveBeenCalledWith(["thai"]);
    expect(mocks.created).not.toHaveBeenCalled();
  });

  it("creates a Cuisine from the Create row in the same list, and ticks what was made", () => {
    mocks.entries = [{ id: "thai", name: "Thai" }];
    const onChange = openSheet(["thai"]);

    fireEvent.change(screen.getByTestId("editor-cuisine-search"), {
      target: { value: "Peruvian" },
    });
    fireEvent.click(screen.getByRole("button", { name: "recipes.picker.create Peruvian" }));

    expect(mocks.created).toHaveBeenCalledWith("Peruvian");
    expect(onChange).toHaveBeenCalledWith(["thai", "new-Peruvian"]);
  });

  it("offers Create offline but disabled", () => {
    mocks.offline = true;
    openSheet();

    fireEvent.change(screen.getByTestId("editor-cuisine-search"), {
      target: { value: "Peruvian" },
    });

    expect((screen.getByTestId("editor-cuisine-create") as HTMLButtonElement).disabled).toBe(true);
  });
});
