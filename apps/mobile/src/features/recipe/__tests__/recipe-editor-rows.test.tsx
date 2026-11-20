// @vitest-environment jsdom
import type { ReactNode } from "react";
import React, { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { resolveDrop } from "../../../components/drag-list/resolve-drop";

type Props = {
  testID?: string;
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};
type DragRows = Parameters<typeof resolveDrop>[0];

const state = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  isUploading: false,
  /** The photo sheet's pick, waiting for the reader to choose a photo. */
  pendingPick: null as (() => void) | null,
  galleryUpload: null as PromiseWithResolvers<object[]> | null,
  lists: new Map<string, { rows: unknown[]; onDrop: (drop: unknown) => void }>(),
}));

const host = ({ testID, children }: Props) => <div data-testid={testID}>{children}</div>;

vi.mock("react-native", () => ({
  View: host,
  Text: ({ children }: Props) => <span>{children}</span>,
  ScrollView: host,
  Image: () => null,
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
  TextInput: ({
    ref,
    testID,
    value,
    onChangeText,
    onFocus,
    onBlur,
  }: {
    ref?: React.Ref<HTMLTextAreaElement>;
    testID?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    onFocus?: (event: { currentTarget: number }) => void;
    onBlur?: () => void;
  }) => (
    <textarea
      ref={ref}
      data-testid={testID}
      value={value}
      onBlur={() => onBlur?.()}
      onChange={(event) => onChangeText?.(event.target.value)}
      onFocus={() => onFocus?.({ currentTarget: 0 })}
    />
  ),
  Alert: { alert: vi.fn() },
  ActionSheetIOS: { showActionSheetWithOptions: vi.fn() },
  Keyboard: { isVisible: () => false, addListener: () => ({ remove: () => {} }) },
  KeyboardAvoidingView: ({ children }: Props) => children,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ default: () => null }));
vi.mock("uniwind", () => ({ withUniwind: () => () => null }));
vi.mock("heroui-native", () => ({
  Skeleton: () => null,
  useThemeColor: (names: readonly string[]) => names.map(() => "#000"),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ back: vi.fn(), dismissTo: vi.fn() }) }));
vi.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));
vi.mock("@/components/drag-list/drag-list", () => ({
  DragScrollView: ({ children }: Props) => children,
  DragHandle: ({ children }: Props) => children,
  useIsLifted: () => false,
  useIsCarried: () => false,
  DragList: ({
    rows,
    renderItem,
    onDrop,
  }: {
    rows: { key: string; value: unknown }[];
    renderItem: (value: unknown) => ReactNode;
    onDrop: (drop: unknown) => void;
  }) => {
    state.lists.set(rows[0]?.key.split("-")[0] ?? "", { rows, onDrop });

    return rows.map((row) => <div key={row.key}>{renderItem(row.value)}</div>);
  },
}));
vi.mock("@/components/modal-header", () => import("../../../../__tests__/mocks/modal-header"));
vi.mock("@/components/glass", () => ({
  GlassSurface: () => null,
  GlassCloseButton: ({ testID, onPress }: Props) => (
    <button data-testid={testID} type="button" onClick={onPress} />
  ),
}));
vi.mock("@/hooks/use-category-label", () => ({ useCategoryLabel: () => (name: string) => name }));
vi.mock("@/hooks/use-photo-source-sheet", () => ({
  // The sheet answers after the tap, with the handler of the render the tap was made in.
  usePhotoSourceSheet: () => (_options: unknown, onPicked: (assets: { uri: string }[]) => void) => {
    state.pendingPick = () => onPicked([{ uri: "/recipes/r/steps/new.jpg" }]);
  },
}));
vi.mock("@/components/server-image", () => ({ ServerImage: () => null }));
vi.mock("@/components/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconSlots: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../components/fade-edge", () => ({ FadeEdge: () => null }));
vi.mock("../components/tint", () => ({ SectionCard: ({ children }: Props) => children }));
vi.mock("../components/editor/detail-cards", () => ({
  NutritionCard: () => null,
  ServingsAndTimeCard: () => null,
  TagsAndCategoriesCard: () => null,
}));
vi.mock("../components/editor/provenance-cards", () => ({
  ProvenanceCard: () => null,
  SourceCard: () => null,
}));
vi.mock("@/hooks/use-focused-field-in-view", async () => {
  const { createContext } = await import("react");

  return {
    FocusedFieldContext: createContext(null),
    useFocusedFieldInView: () => ({ scrollRef: { current: null }, onFieldFocus: () => {} }),
  };
});
vi.mock("../hooks/use-editor-uploads", () => ({
  useEditorUploads: () => ({
    isUploading: state.isUploading,
    pendingFor: () => [],
    cancel: () => {},
    canUpload: () => true,
    uploadGallery: (_assets: unknown[], order: number) => {
      state.galleryUpload = Promise.withResolvers<object[]>();

      return state.galleryUpload.promise.then((added) =>
        added.map((item, index) => ({ ...item, order: order + index }))
      );
    },
    uploadStep: async (assets: { uri: string }[]) =>
      assets.map((asset, order) => ({ image: asset.uri, order })),
    removeGallery: () => {},
    removeStepImage: () => {},
  }),
}));
vi.mock("@norish/shared-react/config", () => ({
  useIngredientsSubscription: () => undefined,
  useUnitsQuery: () => ({ units: {}, isLoading: false }),
  useCategoriesQuery: () => ({ categories: [], builtInAliases: {}, isLoading: false }),
}));
vi.mock("@norish/shared-react/ingredients", () => ({
  useFoodsByName: () => new Map(),
  useIngredientIcons: () => undefined,
}));
vi.mock("@norish/shared-react/reader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDevicePreference: () => ["short"],
}));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipeId: (_mode: string, existing?: string) => ({ recipeId: existing ?? "new-id" }),
  useRecipeMutationErrorToast: () => undefined,
  useRecipesMutations: () => ({ createRecipe: state.create, updateRecipe: state.update }),
}));

const { RecipeEditorScreen } = await import("../screens/recipe-editor-screen");
const { StepRows } = await import("../components/editor/step-rows");

const at = new Date("2026-05-01T10:00:00.000Z");
const line = (
  id: string,
  ingredientName: string,
  amount: number | null,
  unit: string | null,
  order: number
): FullRecipeDTO["recipeIngredients"][number] => ({
  id,
  ingredientId: null,
  ingredientName,
  amount,
  unit,
  order,
  systemUsed: "metric",
  version: 2,
});

/** Sections, `@` references, a line used twice, one that reparses differently, photos, notes. */
const stored: FullRecipeDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  name: "Hoisin chicken",
  description: null,
  url: null,
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  notes: "Thighs stay juicier.",
  systemUsed: "metric",
  originalSystem: "metric",
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  originCountry: null,
  originCountryName: null,
  originRegion: null,
  provenanceNote: null,
  dishColor: null,
  cuisines: [],
  createdAt: at,
  updatedAt: at,
  categories: [],
  version: 7,
  tags: [],
  recipeIngredients: [
    line("ing-1", "# For the sauce", null, null, 0),
    line("ing-2", "salt", null, null, 1),
    line("ing-3", "hoisin sauce", 45, "ml", 2),
    line("ing-4", "salt", null, null, 3),
    // Read back, "1 1/2 lemon" would be one and a half lemons.
    line("ing-5", "1/2 lemon", 1, null, 4),
  ],
  steps: [
    { step: "# Prep", order: 0, systemUsed: "metric", version: 1, images: [], stepIngredients: [] },
    {
      step: "Stir in the hoisin sauce and the salt.",
      order: 1,
      systemUsed: "metric",
      version: 4,
      images: [{ id: "step-img-1", image: "/recipes/r/steps/a.jpg", order: 0, version: 1 }],
      stepIngredients: [
        { ingredientOrder: 2, share: 0.5, order: 0 },
        { ingredientOrder: 3, share: 1, order: 1 },
      ],
    },
    {
      step: "Squeeze the lemon over.",
      order: 2,
      systemUsed: "metric",
      version: 1,
      images: [],
      stepIngredients: [{ ingredientOrder: 4, share: 1, order: 0 }],
    },
  ],
  images: [{ id: "img-1", image: "/recipes/r/a.jpg", order: 0, generated: false, version: 3 }],
  videos: [],
};

type Payload = {
  recipeIngredients: { id?: string; ingredientName: string; order: number }[];
  steps: {
    step: string;
    images: { image: string }[];
    stepIngredients: { ingredientOrder: number; share: number }[];
  }[];
  images: { id?: string; image: string }[];
};

const input = (id: string) => screen.getByTestId(id) as HTMLTextAreaElement;
const type = (id: string, text: string) => fireEvent.change(input(id), { target: { value: text } });
const save = () => fireEvent.click(screen.getByTestId("header-confirm"));
const saved = () => state.update.mock.calls.at(-1)?.[1] as Payload;
/** Which line, by id, each step's references point at in the payload. */
const refIds = (payload: Payload) =>
  payload.steps.map((step) =>
    step.stepIngredients.map(
      (ref) => payload.recipeIngredients.find((ing) => ing.order === ref.ingredientOrder)?.id
    )
  );
const drop = (list: "ing" | "step", from: number, to: number) => {
  const { rows, onDrop } = state.lists.get(list)!;

  act(() => onDrop(resolveDrop(rows as DragRows, from, to)));
};

describe("RecipeEditorScreen with its real rows", () => {
  beforeEach(() => {
    state.create.mockReset();
    state.update.mockReset();
    state.isUploading = false;
    state.pendingPick = null;
    state.galleryUpload = null;
  });

  it("saves an untouched recipe as it was loaded, after its rows were visited", () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    // Every row is focused and left; the trailing rows are typed into and cleared.
    for (const id of [0, 1, 2, 3, 4].map((index) => `editor-ingredient-input-${index}`)) {
      fireEvent.focus(input(id));
      fireEvent.blur(input(id));
    }
    fireEvent.click(screen.getByTestId("editor-add-ingredient"));
    type("editor-ingredient-input-5", "x");
    type("editor-ingredient-input-5", "");
    fireEvent.blur(input("editor-ingredient-input-5"));
    fireEvent.click(screen.getByTestId("editor-add-step"));
    type("editor-step-input-3", "x");
    type("editor-step-input-3", "");
    fireEvent.blur(input("editor-step-input-3"));
    save();

    const payload = saved();

    expect(payload.recipeIngredients).toEqual(
      stored.recipeIngredients.map(({ id, version, ingredientName, amount, unit, order }) =>
        expect.objectContaining({ id, version, ingredientName, amount, unit, order })
      )
    );
    expect(payload.steps).toEqual(
      stored.steps.map(({ step, order, version, images, stepIngredients }) =>
        expect.objectContaining({ step, order, version, images, stepIngredients })
      )
    );
    expect(state.update.mock.calls[0]?.[0]).toBe(stored.id);
  });

  it("keeps every reference on its line when a referenced line is moved", () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    drop("ing", 3, 0);
    // A step edit after the move saves the rows' own copy of the references.
    type("editor-step-input-2", "Squeeze the lemon over it.");
    save();

    expect(saved().recipeIngredients.map((ing) => ing.id)).toEqual([
      "ing-4",
      "ing-1",
      "ing-2",
      "ing-3",
      "ing-5",
    ]);
    expect(refIds(saved())).toEqual([[], ["ing-3", "ing-4"], ["ing-5"]]);
  });

  it("keeps a reference on its line when a line above is cleared and Save tapped at once", () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    fireEvent.focus(input("editor-ingredient-input-1"));
    type("editor-ingredient-input-1", "");
    save();

    expect(refIds(saved())).toEqual([[], ["ing-3", "ing-4"], ["ing-5"]]);
  });

  it("puts a step photo on the step whose button was tapped", async () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    fireEvent.click(screen.getByTestId("editor-step-photo-2"));
    await act(async () => state.pendingPick?.());
    save();

    expect(saved().steps.map((step) => step.images.map((image) => image.image))).toEqual([
      [],
      ["/recipes/r/steps/a.jpg"],
      ["/recipes/r/steps/new.jpg"],
    ]);
  });

  it("keeps a gallery photo removed while another uploads removed", async () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    fireEvent.click(screen.getByTestId("editor-media-add"));
    act(() => state.pendingPick?.());
    fireEvent.click(screen.getByTestId("editor-media-remove-0"));
    await act(async () => state.galleryUpload?.resolve([{ type: "image", src: "/new.jpg" }]));
    save();

    expect(saved().images.map((image) => image.image)).toEqual(["/new.jpg"]);
  });

  it("orders a gallery photo by the strip as it is when the upload ends", async () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    fireEvent.click(screen.getByTestId("editor-media-add"));
    act(() => state.pendingPick?.());
    fireEvent.click(screen.getByTestId("editor-media-remove-0"));
    await act(async () => state.galleryUpload?.resolve([{ type: "image", src: "/new.jpg" }]));
    save();

    expect(saved().images).toEqual([expect.objectContaining({ image: "/new.jpg", order: 0 })]);
  });

  it("does not save while a photo uploads", () => {
    state.isUploading = true;
    render(<RecipeEditorScreen initialData={stored} mode="edit" />);
    save();

    expect(screen.getByTestId("header-confirm")).toHaveProperty("disabled", true);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("creates once on a double tap", () => {
    render(<RecipeEditorScreen mode="create" />);
    type("editor-name", "Soup");
    type("editor-ingredient-input-0", "salt");
    type("editor-step-input-0", "Stir.");
    save();
    save();

    expect(state.create).toHaveBeenCalledOnce();
  });
});

describe("StepRows photos", () => {
  it("tells the form once about an uploaded step photo, under StrictMode too", async () => {
    const onChange = vi.fn();
    const uploads = {
      canUpload: () => true,
      pendingFor: () => [],
      uploadStep: async (assets: { uri: string }[]) =>
        assets.map((asset, order) => ({ image: asset.uri, order })),
    } as unknown as Parameters<typeof StepRows>[0]["uploads"];

    render(
      <StrictMode>
        <StepRows
          ingredients={[]}
          lineMoves={null}
          steps={[{ step: "Stir.", order: 0, systemUsed: "metric" }]}
          systemUsed="metric"
          uploads={uploads}
          onChange={onChange}
        />
      </StrictMode>
    );
    fireEvent.click(screen.getByTestId("editor-step-photo-0"));
    await act(async () => state.pendingPick?.());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0][0].images).toEqual([
      { image: "/recipes/r/steps/new.jpg", order: 0 },
    ]);
  });
});

describe("StepRows uploads that end together", () => {
  const deferredUploads = () => {
    const pending: PromiseWithResolvers<{ image: string; order: number }[]>[] = [];
    const uploads = {
      canUpload: () => true,
      pendingFor: () => [],
      uploadStep: () => {
        pending.push(Promise.withResolvers());

        return pending.at(-1)!.promise;
      },
    } as unknown as Parameters<typeof StepRows>[0]["uploads"];

    return { pending, uploads };
  };
  const renderRows = (uploads: Parameters<typeof StepRows>[0]["uploads"]) => {
    const onChange = vi.fn();

    render(
      <StepRows
        ingredients={[]}
        lineMoves={null}
        steps={[{ step: "Stir.", order: 0, systemUsed: "metric" }]}
        systemUsed="metric"
        uploads={uploads}
        onChange={onChange}
      />
    );

    return onChange;
  };
  const pick = () => {
    fireEvent.click(screen.getByTestId("editor-step-photo-0"));
    act(() => state.pendingPick?.());
  };

  it("keeps both photos when two uploads end in the same tick", async () => {
    const { pending, uploads } = deferredUploads();
    const onChange = renderRows(uploads);

    pick();
    pick();
    await act(async () => {
      pending[0]!.resolve([{ image: "/a.jpg", order: 0 }]);
      pending[1]!.resolve([{ image: "/b.jpg", order: 0 }]);
    });

    expect(
      onChange.mock.calls.at(-1)?.[0][0].images.map((image: { image: string }) => image.image)
    ).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("keeps an edit made while the photo uploaded", async () => {
    const { pending, uploads } = deferredUploads();
    const onChange = renderRows(uploads);

    pick();
    await act(async () => {
      pending[0]!.resolve([{ image: "/a.jpg", order: 0 }]);
      await pending[0]!.promise;
      // A bare event, so the edit lands before the photo's render has committed.
      const field = input("editor-step-input-0");

      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
        field,
        "Stir well."
      );
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onChange.mock.calls.at(-1)?.[0][0]).toMatchObject({
      step: "Stir well.",
      images: [{ image: "/a.jpg", order: 0 }],
    });
  });
});

describe("StepRows dropped while a photo uploads", () => {
  it("keeps the photo that finished while the step was held", async () => {
    const upload = Promise.withResolvers<{ image: string; order: number }[]>();
    const uploads = {
      canUpload: () => true,
      pendingFor: () => [],
      uploadStep: () => upload.promise,
    } as unknown as Parameters<typeof StepRows>[0]["uploads"];
    const onChange = vi.fn();

    render(
      <StepRows
        ingredients={[]}
        lineMoves={null}
        steps={[
          { step: "Stir.", order: 0, systemUsed: "metric" },
          { step: "Serve.", order: 1, systemUsed: "metric" },
        ]}
        systemUsed="metric"
        uploads={uploads}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId("editor-step-photo-0"));
    act(() => state.pendingPick?.());
    // The list holds the rows it was lifted from while the upload ends.
    const lifted = state.lists.get("step")!.rows as DragRows;

    await act(async () => upload.resolve([{ image: "/a.jpg", order: 0 }]));
    act(() => state.lists.get("step")!.onDrop(resolveDrop(lifted, 0, 1)));

    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject([
      { step: "Serve.", images: [] },
      { step: "Stir.", images: [{ image: "/a.jpg", order: 0 }] },
    ]);
  });
});

describe("StepRows when lines move", () => {
  it("keeps the form's references when two moves land in one render", () => {
    const onChange = vi.fn();
    const lines = stored.recipeIngredients.map((ing) => ({ ...ing, unit: ing.unit ?? null }));
    const step = {
      ...stored.steps[2]!,
      stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
    };
    const props = { ingredients: lines, systemUsed: "metric" as const, onChange };
    const uploads = { pendingFor: () => [] } as unknown as Parameters<
      typeof StepRows
    >[0]["uploads"];
    const view = render(<StepRows {...props} lineMoves={null} steps={[step]} uploads={uploads} />);

    // The line went 1 → 2, then 2 → 4; the form applied both, the rows see only the last move.
    view.rerender(
      <StepRows
        {...props}
        lineMoves={
          new Map([
            [2, 4],
            [4, 2],
          ])
        }
        steps={[{ ...step, stepIngredients: [{ ingredientOrder: 4, share: 1, order: 0 }] }]}
        uploads={uploads}
      />
    );
    type("editor-step-input-0", "Squeeze it.");

    expect(onChange.mock.calls.at(-1)?.[0][0].stepIngredients).toEqual([
      { ingredientOrder: 4, share: 1, order: 0 },
    ]);
  });
});
