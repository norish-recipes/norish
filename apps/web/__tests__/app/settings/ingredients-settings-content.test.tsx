/**
 * The Ingredients page: every food folded to a line, the flagged ones
 * marked, and a panel per food holding its spellings and only the actions
 * the server says the viewer may take.
 */
import { useSyncExternalStore } from "react";
import IngredientsSettingsContent from "@/app/(app)/settings/ingredients/components/ingredients-settings-content";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

type Item = {
  id: string;
  name: string;
  flagged: boolean;
  flagReason?: string | null;
  hiddenSpellings?: number;
  parent: { id: string; name: string } | null;
  kinds?: number;
  icon?: string | null;
  ownIcon?: boolean;
  canEdit: boolean;
  localeNames?: Record<string, string>;
  aliases: Array<{
    id: string;
    text: string;
    locale?: string | null;
    seeded?: boolean;
    canRemove: boolean;
  }>;
};

let items: Item[] = [];
let everySpelling: Item["aliases"] = [];
const listInputs: unknown[] = [];
const mutations = {
  saveDraft: vi.fn(async () => ({ success: true })),
  markDistinct: vi.fn(async () => ({ success: true })),
  merge: vi.fn(async () => ({ success: true })),
  moveAlias: vi.fn(async () => ({ success: true })),
  remove: vi.fn(async () => ({ success: true })),
  reviewWithAI: vi.fn(async () => ({
    outcome: "distinct",
    considered: ["salt"],
    englishName: null,
  })),
  reviewAllWithAI: vi.fn(async () => ({ jobId: "round-1", total: 1, pending: ["onion"] })),
  confirmSuggestions: vi.fn(async () => ({ done: 1, failed: 0, refusal: null })),
  dismissSuggestions: vi.fn(async () => ({ done: 1, failed: 0, refusal: null })),
  findParentWithAI: vi.fn(async () => ({
    outcome: "parent",
    of: "vegetable",
    considered: ["vegetable"],
    englishName: null,
  })),
};
const invalidateQueries = vi.fn();
/**
 * The cache as the page patches it before the server answers: the list's
 * rows and the suggestions, written back so the next render shows them.
 */
const setQueriesData = vi.fn(
  ({ queryKey }: { queryKey: unknown[] }, update: (data: unknown) => unknown) => {
    if (queryKey[0] === "ingredients.list") {
      const next = update({ pages: [{ items, nextCursor: null }], pageParams: [] }) as {
        pages: Array<{ items: Item[] }>;
      };

      items = next.pages[0]!.items;
    }
    if (queryKey[0] === "ingredients.suggestions") {
      suggestions = update(suggestions) as unknown[];
    }
    cache.changed();
  }
);
/** A patch to the cache re-renders whatever reads it, as the real cache does. */
const cache = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let version = 0;

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    snapshot: () => version,
    changed: () => {
      version += 1;
      listeners.forEach((listener) => listener());
    },
  };
});
/** The round running on the server when the page opens, as `reviewRound` answers. */
let runningRound: unknown = null;
// A Draw icons round: what each scope holds, and the round running, if any.
let iconScope: { bare: number; unowned: number } | undefined = undefined;
let iconRound: unknown = null;
/** What a round would ask about, across the catalogue, as `reviewScope` answers. */
const scope = {
  flagged: 3,
  unsuggested: 2,
  tokens: {
    basis: "measured" as const,
    foods: 20,
    models: [{ provider: "openai", model: "gpt-5.6-luna", perFood: 3000 }],
  },
};
/** What `reviewReport` answers for the round this tab watched. */
let report: unknown = null;
/** What AI suggests, waiting on a person, as `suggestions` answers. */
let suggestions: unknown[] = [];
/** What `get` answers for a food the list no longer lists. */
let ownItem: unknown = undefined;
/** What `kinds` answers per parent, for the rows folded out under it. */
let kinds: Record<string, Item[]> = {};
/** The observer watching the end of the list, so a test can bring it into view. */
const listEnd = vi.hoisted(() => ({
  onIntersect: undefined as ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined,
}));
const fetchNextPage = vi.fn();
let hasNextPage = false;
/** The last handler the page gave the `onReview` subscription: how a test lets the round move. */
const review = vi.hoisted(() => ({
  onEvent: undefined as ((payload: unknown) => void) | undefined,
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      pathKey: () => ["ingredients"],
      suggestions: {
        queryOptions: () => ({ queryKey: ["ingredients.suggestions"] }),
        pathKey: () => ["ingredients.suggestions"],
      },
      confirmSuggestions: { mutationOptions: () => ({ name: "confirmSuggestions" }) },
      dismissSuggestions: { mutationOptions: () => ({ name: "dismissSuggestions" }) },
      list: {
        infiniteQueryOptions: (input: unknown) => {
          listInputs.push(input);

          return { queryKey: ["ingredients.list", input] };
        },
        pathKey: () => ["ingredients.list"],
      },
      get: {
        queryOptions: (input: unknown) => ({ queryKey: ["ingredients.get", input] }),
        pathKey: () => ["ingredients.get"],
      },
      spellings: {
        queryOptions: (input: unknown) => ({ queryKey: ["ingredients.spellings", input] }),
      },
      saveDraft: { mutationOptions: () => ({ name: "saveDraft" }) },
      uploadIcon: { mutationOptions: () => ({ name: "uploadIcon" }) },
      generateIcon: { mutationOptions: () => ({ name: "generateIcon" }) },
      icons: {
        queryOptions: (input: unknown) => ({ queryKey: ["ingredients.icons", input] }),
        pathKey: () => ["ingredients.icons"],
      },
      markDistinct: { mutationOptions: () => ({ name: "markDistinct" }) },
      merge: { mutationOptions: () => ({ name: "merge" }) },
      moveAlias: { mutationOptions: () => ({ name: "moveAlias" }) },
      remove: { mutationOptions: () => ({ name: "remove" }) },
      reviewWithAI: { mutationOptions: () => ({ name: "reviewWithAI" }) },
      reviewAllWithAI: { mutationOptions: () => ({ name: "reviewAllWithAI" }) },
      findParentWithAI: { mutationOptions: () => ({ name: "findParentWithAI" }) },
      reviewRound: {
        queryOptions: () => ({ queryKey: ["ingredients.reviewRound"] }),
        queryKey: () => ["ingredients.reviewRound"],
      },
      reviewScope: {
        queryOptions: () => ({ queryKey: ["ingredients.reviewScope"] }),
        pathKey: () => ["ingredients.reviewScope"],
      },
      reviewReport: {
        queryOptions: (input: unknown) => ({ queryKey: ["ingredients.reviewReport", input] }),
        pathKey: () => ["ingredients.reviewReport"],
      },
      kinds: {
        queryOptions: (input: { parentId: string }) => ({ queryKey: ["ingredients.kinds", input] }),
        pathKey: () => ["ingredients.kinds"],
      },
      onReview: "onReview",
      onIcons: "onIcons",
      iconScope: {
        queryOptions: () => ({ queryKey: ["ingredients.iconScope"] }),
        queryKey: () => ["ingredients.iconScope"],
      },
      iconRound: {
        queryOptions: () => ({ queryKey: ["ingredients.iconRound"] }),
        queryKey: () => ["ingredients.iconRound"],
      },
      drawIcons: { mutationOptions: () => ({ name: "drawIcons" }) },
    },
  }),
}));

// jsdom lays nothing out, so a panel's scrolling body is 0 tall and the
// suggestions panel's virtualised list would show no row: here it shows them all.
vi.mock("@tanstack/react-virtual", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-virtual")>()),
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: 0, size: 0 })),
    getTotalSize: () => 0,
    measureElement: () => undefined,
  }),
}));

vi.mock("@norish/shared-react/realtime", () => ({
  useRealtimeSubscription: (procedure: unknown, handlers: { onEvent: (p: unknown) => void }) => {
    if (procedure === "onReview") review.onEvent = handlers.onEvent;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: ({ enabled, queryKey }: { enabled?: boolean; queryKey: unknown[] }) => {
    useSyncExternalStore(cache.subscribe, cache.snapshot);
    switch (queryKey[0]) {
      case "ingredients.reviewRound":
        return { data: runningRound, isFetching: false, isPending: false };
      case "ingredients.iconScope":
        return { data: enabled ? iconScope : undefined, isFetching: false, isPending: false };
      case "ingredients.iconRound":
        return { data: enabled ? iconRound : undefined, isFetching: false, isPending: false };
      case "ingredients.reviewScope":
        return { data: enabled ? scope : undefined, isFetching: false, isPending: false };
      case "ingredients.get":
        return { data: enabled ? ownItem : undefined, isFetching: false, isPending: false };
      case "ingredients.suggestions":
        return { data: suggestions, isFetching: false, isPending: false };
      case "ingredients.reviewReport":
        return { data: enabled ? report : undefined, isFetching: false, isPending: false };
      default:
        return { data: enabled ? everySpelling : undefined, isFetching: false, isPending: false };
    }
  },
  useQueries: ({ queries }: { queries: Array<{ queryKey: [string, { parentId: string }] }> }) =>
    queries.map(({ queryKey }) => ({ data: kinds[queryKey[1].parentId] ?? [], isPending: false })),
  useInfiniteQuery: () => {
    useSyncExternalStore(cache.subscribe, cache.snapshot);

    return {
      data: { pages: [{ items, nextCursor: null }] },
      isLoading: false,
      isFetching: false,
      hasNextPage,
      isFetchingNextPage: false,
      fetchNextPage,
    };
  },
  useMutation: ({ name }: { name: keyof typeof mutations }) => ({
    mutateAsync: mutations[name],
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries, setQueriesData }),
}));

let viewerLocale = "en";

vi.mock("usehooks-ts", () => ({
  useDebounceValue: (value: unknown) => [value],
  useWindowSize: () => ({ width: 1024, height: 768 }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => viewerLocale,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

vi.mock("@/lib/ui/safe-error-toast", () => ({ showSafeErrorToast: vi.fn() }));
/** Whether the instance has AI: with it off, nothing on the page offers it. */
const permissions = vi.hoisted(() => ({ isAIEnabled: true, canDrawImages: false }));

vi.mock("@/context/hidden-items-context", () => ({ useHiddenItems: () => [] }));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: permissions.isAIEnabled,
    canDrawImages: permissions.canDrawImages,
  }),
}));

vi.mock("@heroui/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heroui/react")>()),
  toast: Object.assign(vi.fn(), { close: vi.fn() }),
}));

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, "data-testid": testId }: any) => (
    <button data-testid={testId} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children, start }: any) => (
    <div>
      {start}
      {children}
    </div>
  ),
  IconActionButton: ({ label, onPress, action, isDisabled, "data-testid": testId }: any) => (
    <button
      aria-label={label}
      data-testid={testId ?? `icon-${action}`}
      disabled={isDisabled}
      type="button"
      onClick={onPress}
    />
  ),
}));

// A Panel is a dialog named after its title; a closed one renders nothing.
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open, title, titleAddon }: any) =>
    open ? (
      <div aria-label={title} role="dialog">
        {titleAddon}
        {children}
      </div>
    ) : null;

  Panel.Body = ({ children }: any) => <div>{children}</div>;
  Panel.Footer = ({ children }: any) => <div>{children}</div>;

  return { default: Panel, usePanelPortalContainer: () => undefined };
});

// A food's nutrition and its corrections are the nutrition section's own tests' business.
// The panel's Pantry row reads the household's Pantry and groceries; the
// browser spec walks it, so here it is a household that keeps nothing.
vi.mock("@/hooks/config", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSpellingRules: () => undefined,
}));
vi.mock("@/hooks/pantry", () => ({
  usePantryQuery: () => ({ items: [] }),
  usePantryMutations: () => ({ addPantryIngredient: vi.fn(), removePantryIngredient: vi.fn() }),
}));
vi.mock("@/hooks/groceries", () => ({ useGroceriesQuery: () => ({ groceries: [] }) }));
vi.mock("@/components/groceries/pantry/put-on-the-list", () => ({
  PutOnTheList: () => null,
  usePutOnTheList: () => vi.fn(),
}));
vi.mock("@/components/ingredients/ingredient-nutrition", () => ({
  IngredientNutritionSection: () => <section data-testid="ingredient-nutrition" />,
}));

let linkedIngredient: string | null = null;

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(linkedIngredient ? { ingredient: linkedIngredient } : {}),
}));

// The picker searches the catalogue; here it offers salt.
vi.mock("@/components/ingredients/ingredient-picker", () => ({
  IngredientPicker: ({ onPick, editableOnly, excludeId }: any) => (
    <div data-editable-only={editableOnly} data-exclude={excludeId} data-testid="picker">
      <button type="button" onClick={() => onPick({ id: "salt", name: "salt" })}>
        pick-salt
      </button>
    </div>
  ),
}));

const onion: Item = {
  id: "onion",
  name: "onion",
  flagged: true,
  parent: null,
  canEdit: true,
  aliases: [
    { id: "a-onion", text: "onion", canRemove: true },
    { id: "a-ui", text: "ui", canRemove: false },
  ],
};
const salt: Item = {
  id: "salt",
  name: "salt",
  flagged: false,
  parent: { id: "mineral", name: "mineral" },
  canEdit: false,
  aliases: [{ id: "a-salt", text: "salt", canRemove: false }],
};

function row(name: string) {
  return screen
    .getAllByTestId("ingredient-row")
    .find((element) => element.getAttribute("data-ingredient") === name)!;
}

/** The open food's panel, named after the food. */
function panel(name: string) {
  return screen.getByRole("dialog", { name });
}

/** What AI suggests for `name`, waiting on the viewer. */
function suggestion(
  id: string,
  kind: "merge" | "parent" | "distinct",
  name: string,
  target: string | null,
  ingredientId = name,
  source: "ai" | "words" = "ai"
) {
  return {
    id,
    kind,
    ingredient: { id: ingredientId, name, localeNames: {} },
    target: target ? { id: target, name: target, localeNames: {} } : null,
    englishName: "onions",
    considered: ["onion"],
    source,
  };
}

/** A row folded to a line opens its panel on a press; the edits live there. */
async function open(name: string) {
  await act(async () => {
    fireEvent.click(within(row(name)).getByTestId("ingredient-toggle"));
  });

  return panel(name);
}

/** The spellings sit behind a row of their own, in a panel over the food's. */
async function showSpellings(opened: HTMLElement) {
  await act(async () => {
    fireEvent.click(within(opened).getByTestId("ingredient-all-spellings"));
  });
}

describe("IngredientsSettingsContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedIngredient = null;
    // The end of the list watches for itself scrolling into view; jsdom has no observer.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          listEnd.onIntersect = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    listEnd.onIntersect = undefined;
    hasNextPage = false;
    viewerLocale = "en";
    listInputs.length = 0;
    items = [onion, salt];
    everySpelling = [];
    runningRound = null;
    iconScope = undefined;
    iconRound = null;
    permissions.canDrawImages = false;
    report = null;
    suggestions = [];
    ownItem = undefined;
    kinds = {};
    review.onEvent = undefined;
  });

  it("asks for the next page once the end of the list comes into view, and again while it stays", () => {
    hasNextPage = true;
    render(<IngredientsSettingsContent />);

    expect(fetchNextPage).not.toHaveBeenCalled();
    act(() => {
      listEnd.onIntersect?.([{ isIntersecting: true }]);
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    // The next page lands and the end is still in reach: asked again.
    items = [...items, { ...salt, id: "pepper", name: "pepper" }];
    render(<IngredientsSettingsContent />);
    act(() => {
      listEnd.onIntersect?.([{ isIntersecting: true }]);
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("offers Draw icons only where the instance can draw and the viewer may draw a food", () => {
    iconScope = { bare: 2, unowned: 5 };
    const { unmount } = render(<IngredientsSettingsContent />);

    // Nothing can draw: not offered, whatever is left.
    expect(screen.queryByTestId("ingredients-draw-icons")).toBeNull();
    unmount();

    permissions.canDrawImages = true;
    const drawing = render(<IngredientsSettingsContent />);

    expect(screen.getByTestId("ingredients-draw-icons")).toBeInTheDocument();
    drawing.unmount();

    // Nothing left that the viewer may draw, in either scope.
    iconScope = { bare: 0, unowned: 0 };
    render(<IngredientsSettingsContent />);
    expect(screen.queryByTestId("ingredients-draw-icons")).toBeNull();
  });

  it("shows a running Draw icons round's count in place of its button, and each food still to draw in its row", () => {
    permissions.canDrawImages = true;
    iconScope = { bare: 2, unowned: 5 };
    iconRound = {
      jobId: "icons-1",
      done: 3,
      total: 20,
      counts: { drawn: 3, skipped: 0, failed: 0 },
      pending: ["onion"],
      finished: false,
    };
    render(<IngredientsSettingsContent />);

    expect(screen.getByTestId("ingredients-icon-round-progress")).toHaveTextContent("progress");
    expect(screen.queryByTestId("ingredients-draw-icons")).toBeNull();
    expect(within(row("onion")).getByTestId("ingredient-icon-drawing")).toBeInTheDocument();
    expect(within(row("salt")).queryByTestId("ingredient-icon-drawing")).toBeNull();
  });

  it("shows each food's icon in its row, and nothing for one with none", () => {
    const icon = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";

    items = [{ ...onion, icon, ownIcon: true }, salt];
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-icon").getAttribute("src")).toBe(icon);
    expect(within(row("salt")).queryByTestId("ingredient-icon")).toBeNull();
    expect(within(row("salt")).queryByTestId("ingredient-icon-placeholder")).toBeNull();
  });

  it("lists each food on a line, marks the flagged ones, and opens one to its spellings", async () => {
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-flagged")).toBeInTheDocument();
    expect(within(row("salt")).queryByTestId("ingredient-flagged")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    const opened = await open("onion");

    await showSpellings(opened);

    expect(
      within(opened)
        .getAllByTestId("ingredient-alias")
        .map((chip) => chip.textContent)
    ).toEqual(["onion", "ui"]);
  });

  it("opens the panel of the food a link names, such as a recipe's Not counted line", async () => {
    linkedIngredient = "onion";

    render(<IngredientsSettingsContent />);

    expect(await screen.findByRole("dialog", { name: "onion" })).toBeInTheDocument();
  });

  it("offers only what the viewer may do", async () => {
    render(<IngredientsSettingsContent />);
    const mine = await open("onion");
    await showSpellings(mine);

    expect(within(mine).getByTestId("ingredient-mark-distinct")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-name-input")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-delete")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-merge")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-set-parent")).toBeInTheDocument();
    expect(within(mine).getAllByRole("button", { name: "removeAlias" })).toHaveLength(1);
    expect(within(mine).getAllByTestId("ingredient-alias-move")).toHaveLength(1);

    const theirs = await open("salt");

    await showSpellings(theirs);

    expect(within(theirs).queryByTestId("ingredient-name-input")).toBeNull();
    expect(within(theirs).queryByTestId("ingredient-delete")).toBeNull();
    expect(within(theirs).queryByTestId("ingredient-merge")).toBeNull();
    expect(within(theirs).queryByTestId("ingredient-set-parent")).toBeNull();
    expect(within(theirs).queryByRole("button", { name: "removeAlias" })).toBeNull();
    expect(within(theirs).queryByTestId("ingredient-alias-move")).toBeNull();
    // Adding a spelling is open to everyone.
    expect(within(theirs).getByTestId("ingredient-alias-input")).toBeInTheDocument();
  });

  it("marks a flagged food distinct", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-mark-distinct"));
    });

    expect(mutations.markDistinct).toHaveBeenCalledWith({ ingredientId: "onion" });
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it("renames a food from its name field, saved with the panel's Save", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    const field = within(opened).getByTestId("ingredient-name-input");

    // Nothing to save until something differs.
    expect(within(opened).getByTestId("ingredient-save")).toBeDisabled();

    await act(async () => {
      fireEvent.change(field, { target: { value: "Onion" } });
    });

    expect(mutations.saveDraft).not.toHaveBeenCalled();
    expect(within(opened).getByTestId("ingredient-save")).toBeEnabled();

    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      name: "Onion",
      add: [],
      remove: [],
    });
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it("deletes a food once the viewer confirms", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });

    expect(mutations.remove).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });

    expect(mutations.remove).toHaveBeenCalledWith({ ingredientId: "onion" });
    expect(invalidateQueries).toHaveBeenCalled();
    // The row is gone the moment the viewer confirms, not when the server answers.
    expect(items.map((item) => item.id)).toEqual(["salt"]);
  });

  it("shows a refused edit undone, and says why", async () => {
    mutations.remove.mockRejectedValueOnce(new Error("ingredient-in-use"));
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });

    // The guess is read back from the server rather than kept.
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["ingredients"] });
    expect(showSafeErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "errors.ingredient-in-use",
        context: "ingredients:delete",
      })
    );
  });

  it("adds a household's own spelling, staged until Save", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("salt");
    await showSpellings(opened);
    const field = within(opened).getByTestId("ingredient-alias-input");

    await act(async () => {
      fireEvent.change(field, { target: { value: " zout " } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    // Staged as a chip of its own; nothing has been sent.
    expect(field).toHaveValue("");
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    expect(
      within(opened)
        .getAllByTestId("ingredient-alias")
        .map((chip) => chip.textContent)
    ).toEqual(["salt", "zout"]);

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "salt",
      add: ["zout"],
      remove: [],
    });
  });

  it("removes a spelling on Save, and keeps one un-removed before it", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    await showSpellings(opened);
    const remove = () => within(opened).getByRole("button", { name: "removeAlias" });

    fireEvent.click(remove());
    // Marked for removal, the chip stays, struck through, with a way back.
    expect(within(opened).getAllByTestId("ingredient-alias")[0]).toHaveAttribute(
      "data-pending",
      "removed"
    );
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    fireEvent.click(within(opened).getByRole("button", { name: "keepAlias" }));
    expect(within(opened).getByTestId("ingredient-save")).toBeDisabled();

    fireEvent.click(remove());
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      add: [],
      remove: ["a-onion"],
    });
  });

  it("merges a food into one the viewer may edit, picked in a panel of its own", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    expect(screen.queryByRole("dialog", { name: "mergeInto" })).toBeNull();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-merge"));
    });
    const asking = screen.getByRole("dialog", { name: "mergeInto" });
    const picker = within(asking).getByTestId("picker");

    expect(picker).toHaveAttribute("data-editable-only", "true");
    expect(picker).toHaveAttribute("data-exclude", "onion");
    expect(within(asking).queryByTestId("ingredient-relocation-new")).toBeNull();
    expect(within(asking).getByTestId("ingredient-relocation-confirm")).toBeDisabled();

    await act(async () => {
      fireEvent.click(within(picker).getByText("pick-salt"));
    });
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });

    expect(mutations.merge).toHaveBeenCalledWith({ sourceId: "onion", targetId: "salt" });
    expect(screen.queryByRole("dialog", { name: "mergeInto" })).toBeNull();
  });

  it("moves a spelling out to a new food", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    await showSpellings(opened);

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-alias-move"));
    });
    const asking = screen.getByRole("dialog", { name: "moveTo" });

    // Its own food is a button of its own, not a search result typing would filter away.
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-new"));
    });

    expect(mutations.moveAlias).toHaveBeenCalledWith({ aliasId: "a-onion", targetId: null });
  });

  it("sets the food a food is a kind of, from any Ingredient", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    expect(within(opened).queryByTestId("ingredient-clear-parent")).toBeNull();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-set-parent"));
    });
    const asking = screen.getByRole("dialog", { name: "setParent" });
    const picker = within(asking).getByTestId("picker");

    expect(picker).toHaveAttribute("data-editable-only", "false");
    await act(async () => {
      fireEvent.click(within(picker).getByText("pick-salt"));
    });
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });

    // Picked, the parent joins the draft; it lands with Save.
    expect(within(opened).getByTestId("ingredient-parent")).toHaveTextContent("salt");
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      parentId: "salt",
      add: [],
      remove: [],
    });
  });

  it("folds a food's kinds out beneath it, and asks for them only then", async () => {
    items = [{ ...onion, kinds: 1 }, salt];
    kinds = { onion: [{ ...onion, id: "red", name: "red onion", kinds: 1, flagged: false }] };
    render(<IngredientsSettingsContent />);

    // With nothing typed and no filter on, the list is the roots.
    expect(listInputs.at(-1)).toMatchObject({ rootsOnly: true });
    expect(screen.queryAllByTestId("ingredient-row").map((r) => r.dataset.ingredient)).toEqual([
      "onion",
      "salt",
    ]);
    // A food with kinds carries a live chevron; one without, none to press.
    expect(within(row("salt")).getByTestId("ingredient-kinds-toggle")).toBeDisabled();
    const toggle = within(row("onion")).getByTestId("ingredient-kinds-toggle");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(screen.queryAllByTestId("ingredient-row").map((r) => r.dataset.ingredient)).toEqual([
      "onion",
      "red onion",
      "salt",
    ]);
    expect(row("red onion")).toHaveAttribute("data-depth", "1");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // A folded-out kind opens its panel like any row.
    await open("red onion");

    fireEvent.click(toggle);
    expect(screen.queryAllByTestId("ingredient-row")).toHaveLength(2);
  });

  it("lists flat when the filters panel says so", async () => {
    items = [{ ...onion, kinds: 1 }];
    render(<IngredientsSettingsContent />);

    fireEvent.click(screen.getByTestId("ingredients-filters"));
    const filters = screen.getByRole("dialog", { name: "title" });

    fireEvent.click(within(filters).getByRole("switch", { name: "asTree" }));
    await act(async () => {
      fireEvent.click(within(filters).getByTestId("ingredients-filters-apply"));
    });

    expect(listInputs.at(-1)).not.toHaveProperty("rootsOnly", true);
    expect(listInputs.at(-1)).not.toHaveProperty("tree");
    expect(within(row("onion")).queryByTestId("ingredient-kinds-toggle")).toBeNull();
  });

  it("lists the foods with neither parent nor kinds on request, and offers to find their parents", async () => {
    items = [{ ...onion, flagged: false, kinds: 0 }, salt];
    render(<IngredientsSettingsContent />);

    expect(screen.queryByTestId("ingredients-find-parents-all")).toBeNull();
    fireEvent.click(screen.getByTestId("ingredients-filters"));
    const filters = screen.getByRole("dialog", { name: "title" });

    fireEvent.click(within(filters).getByRole("switch", { name: "standaloneOnly" }));
    await act(async () => {
      fireEvent.click(within(filters).getByTestId("ingredients-filters-apply"));
    });

    expect(listInputs.at(-1)).toMatchObject({ standaloneOnly: true });
    expect(listInputs.at(-1)).not.toHaveProperty("rootsOnly", true);

    // Only onion is the viewer's to file; salt has a parent already. No dialog: the foods are on screen.
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-find-parents-all"));
    });

    expect(mutations.reviewAllWithAI).toHaveBeenCalledExactlyOnceWith({
      mode: "parent",
      ingredientIds: ["onion"],
    });
    expect(screen.queryByTestId("ingredients-ask-ai-dialog")).toBeNull();
    // Unflagged, the row still shows its turn in the round.
    expect(within(row("onion")).getByTestId("ingredient-reviewing")).toBeInTheDocument();
  });

  it("asks AI what one food is a kind of, from its panel, where it has no parent", async () => {
    items = [{ ...onion, flagged: false }, salt];
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-find-parent"));
    });

    expect(mutations.findParentWithAI).toHaveBeenCalledWith({ ingredientId: "onion" });
    expect(toast).toHaveBeenCalledWith(
      "aiOutcomes.parent",
      expect.objectContaining({ variant: "accent" })
    );
    expect(invalidateQueries).toHaveBeenCalled();

    // A food with a parent, or one the viewer may not edit, is not offered it.
    const theirs = await open("salt");

    expect(within(theirs).queryByTestId("ingredient-find-parent")).toBeNull();
  });

  it("lists flat under a search, where a match may sit at any depth", () => {
    items = [{ ...onion, kinds: 1 }];
    render(<IngredientsSettingsContent />);
    // No chevron column at all when flat.
    act(() => {
      fireEvent.change(screen.getByTestId("ingredients-search"), { target: { value: "oni" } });
    });

    expect(listInputs.at(-1)).toMatchObject({ search: "oni" });
    expect(listInputs.at(-1)).not.toHaveProperty("rootsOnly", true);
    expect(within(row("onion")).queryByTestId("ingredient-kinds-toggle")).toBeNull();
  });

  it("shows a food's parent, and offers to clear it only where the viewer may edit", async () => {
    items = [
      onion,
      salt,
      { ...onion, id: "red", name: "red onion", parent: { id: "onion", name: "onion" } },
    ];
    render(<IngredientsSettingsContent />);

    // Folded, the parent is in the summary; opened, it is a line of its own.
    expect(within(row("salt")).getByTestId("ingredient-toggle")).toHaveTextContent("summary");

    const theirs = await open("salt");

    expect(within(theirs).getByTestId("ingredient-parent")).toHaveTextContent("mineral");
    expect(within(theirs).queryByTestId("ingredient-clear-parent")).toBeNull();

    const mine = await open("red onion");

    fireEvent.click(within(mine).getByTestId("ingredient-clear-parent"));
    expect(within(mine).queryByTestId("ingredient-clear-parent")).toBeNull();
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(mine).getByTestId("ingredient-save"));
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "red",
      parentId: null,
      add: [],
      remove: [],
    });
  });

  it("asks for the flagged ones alone when filtered", async () => {
    render(<IngredientsSettingsContent />);

    // The filters live in a panel and land with Apply, as the dashboard's do.
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-filters"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: "flaggedOnly" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-filters-apply"));
    });

    expect(listInputs.at(-1)).toEqual({
      search: undefined,
      match: "contains",
      fields: ["name", "translations"],
      flaggedOnly: true,
      standaloneOnly: false,
      rootsOnly: undefined,
      locale: "en",
    });
  });

  it("shows a food in the viewer's language, its own name beside it", async () => {
    viewerLocale = "nl";
    // The server sent the viewer's spellings and a person's own; the rest on request.
    items = [
      {
        ...onion,
        localeNames: { nl: "ui" },
        aliases: [
          { id: "a-ui", text: "ui", locale: "nl", seeded: true, canRemove: false },
          { id: "a-ajuin", text: "ajuin", locale: null, seeded: false, canRemove: true },
        ],
        hiddenSpellings: 2,
      },
    ];
    everySpelling = [
      { id: "a-onion", text: "onion", locale: "en", seeded: true, canRemove: false },
      { id: "a-ui", text: "ui", locale: "nl", seeded: true, canRemove: false },
      { id: "a-zwiebel", text: "Zwiebel", locale: "de", seeded: true, canRemove: false },
      { id: "a-ajuin", text: "ajuin", locale: null, seeded: false, canRemove: true },
    ];
    render(<IngredientsSettingsContent />);

    expect(row("onion")).toHaveTextContent("ui");
    // The panel is named in the viewer's language too.
    await act(async () => {
      fireEvent.click(within(row("onion")).getByTestId("ingredient-toggle"));
    });
    const opened = panel("ui");
    const chips = (scope: HTMLElement) =>
      within(scope)
        .getAllByTestId("ingredient-alias")
        .map((chip) => chip.textContent);

    expect(within(opened).getByText("shownAs")).toBeInTheDocument();
    // The panel names how many; the spellings themselves are a click through.
    expect(within(opened).queryByTestId("ingredient-alias")).toBeNull();
    expect(within(opened).getByTestId("ingredient-all-spellings")).toHaveTextContent(
      "spellingsCount"
    );
    await showSpellings(opened);
    expect(chips(screen.getByTestId("ingredient-spellings-all"))).toEqual([
      "onion",
      "ui",
      "Zwiebel",
      "ajuin",
    ]);
  });

  it("asks for no more spellings where the server sent them all", async () => {
    items = [
      {
        ...salt,
        aliases: [{ id: "a-zout", text: "zout", locale: "nl", seeded: true, canRemove: false }],
        hiddenSpellings: 0,
      },
    ];
    render(<IngredientsSettingsContent />);
    const opened = await open("salt");

    await showSpellings(opened);
    // Nothing more to fetch: the chips are the ones the server sent.
    expect(within(opened).getAllByTestId("ingredient-alias")).toHaveLength(1);
  });

  it("says why a food is flagged, on the fold and in the panel, and offers to ask AI", async () => {
    items = [{ ...onion, flagReason: "ai-unsure" }, salt];
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-flag-reason")).toHaveTextContent(
      "flagReasons.ai-unsure"
    );
    expect(within(row("salt")).queryByTestId("ingredient-flag-reason")).toBeNull();

    const opened = await open("onion");

    expect(within(opened).getByTestId("ingredient-flag-notice")).toHaveTextContent(
      "flagReasons.ai-unsure"
    );
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-ask-ai"));
    });

    expect(mutations.reviewWithAI).toHaveBeenCalledWith({ ingredientId: "onion" });
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it("asks which flagged foods first, then asks AI about them as one round, and watches it", async () => {
    render(<IngredientsSettingsContent />);

    fireEvent.click(screen.getByTestId("ingredients-ask-ai-all"));

    // Nothing is asked yet: a dialog says what a round would cover, across the catalogue.
    const dialog = screen.getByTestId("ingredients-ask-ai-dialog");

    expect(mutations.reviewAllWithAI).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId("ingredients-ask-ai-tokens")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId("ingredients-ask-ai-start"));
    });

    // The server picks the foods for the scope; the page waits on the ones it names.
    expect(mutations.reviewAllWithAI).toHaveBeenCalledExactlyOnceWith({
      mode: "review",
      scope: "unsuggested",
    });
    expect(screen.queryByTestId("ingredients-ask-ai-dialog")).toBeNull();
    expect(mutations.reviewWithAI).not.toHaveBeenCalled();
    // The row shows its turn, and the header how far the round has come, in place of the button.
    expect(within(row("onion")).getByTestId("ingredient-reviewing")).toBeInTheDocument();
    expect(screen.getByTestId("ingredients-round-progress")).toHaveTextContent("roundProgress");
    expect(screen.queryByTestId("ingredients-ask-ai-all")).toBeNull();

    // By the time the round ends, AI's suggestions are waiting.
    suggestions = [
      suggestion("s1", "merge", "uitjes", "onion"),
      suggestion("s2", "parent", "red onion", "onion"),
    ];
    report = {
      jobId: "round-1",
      finished: true,
      entries: [
        {
          ingredientId: "onion",
          name: "uitjes",
          outcome: "merge",
          into: "onion",
          considered: ["onion", "shallot"],
          englishName: "onions",
        },
        { ingredientId: "x", name: "Unox Knaks", outcome: "failed", error: "Failed query" },
      ],
    };
    const counts = { merge: 1, parent: 0, distinct: 0, unsure: 0, skipped: 0, failed: 0 };

    act(() => {
      review.onEvent?.({
        jobId: "round-1",
        done: 1,
        total: 1,
        counts,
        pending: [],
        finished: true,
      });
    });

    // The round this tab started ends with the suggestions drawer open, no toast, and the list read again.
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ingredient-reviewing")).toBeNull();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["ingredients.list"] });

    const shown = screen.getByRole("dialog", { name: "suggestionsTitle" });
    const listed = within(shown).getAllByTestId("ingredient-suggestion");

    expect(listed.map((it) => it.getAttribute("data-kind"))).toEqual(["merge", "parent"]);
    expect(listed[0]).toHaveTextContent("uitjes");
    expect(listed[0]).toHaveTextContent("proposal.merge");
    expect(listed[0]).toHaveTextContent("aiTrace.readAs");
    // A food the round got no suggestion for says why, below.
    const unsuggested = within(shown).getAllByTestId("ingredients-review-entry");

    expect(unsuggested.map((it) => it.getAttribute("data-outcome"))).toEqual(["failed"]);
    expect(unsuggested[0]).toHaveTextContent("Failed query");

    // One at a time, or all at once.
    await act(async () => {
      fireEvent.click(within(listed[1]!).getByTestId("ingredient-suggestion-dismiss"));
    });
    expect(mutations.dismissSuggestions).toHaveBeenCalledWith({ suggestionIds: ["s2"] });
    // The answered row leaves the table at once, before the server answers.
    expect(within(shown).getAllByTestId("ingredient-suggestion")).toHaveLength(1);
    await act(async () => {
      fireEvent.click(within(shown).getByTestId("ingredient-suggestions-confirm-all"));
    });
    expect(mutations.confirmSuggestions).toHaveBeenCalledWith({ suggestionIds: ["s1"] });
    expect(within(shown).queryAllByTestId("ingredient-suggestion")).toHaveLength(0);
  });

  it("fills AI's parent into the draft, marked as AI's, to keep with Save or dismiss", async () => {
    suggestions = [suggestion("s1", "parent", "onion", "vegetable", "onion")];
    render(<IngredientsSettingsContent />);
    const details = await open("onion");

    expect(within(details).getByTestId("ingredient-parent")).toHaveTextContent("vegetable");
    expect(within(details).getByTestId("ingredient-parent-suggested")).toBeInTheDocument();
    // The name stays the viewer's to edit meanwhile.
    expect(within(details).getByTestId("ingredient-name-input")).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-save"));
    });
    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      parentId: "vegetable",
      add: [],
      remove: [],
    });
    // The row is filed under the parent at once.
    expect(items.find((item) => item.id === "onion")?.parent?.id).toBe("vegetable");
  });

  it("dismisses AI's parent from the draft, which takes it off again", async () => {
    suggestions = [suggestion("s1", "parent", "onion", "vegetable", "onion")];
    render(<IngredientsSettingsContent />);
    const details = await open("onion");

    await act(async () => {
      fireEvent.click(within(details).getByTestId("ingredient-clear-parent"));
    });
    expect(mutations.dismissSuggestions).toHaveBeenCalledWith({ suggestionIds: ["s1"] });
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    expect(within(details).getByTestId("ingredient-parent")).not.toHaveTextContent("vegetable");
  });

  it("puts AI's merge at the top of the panel, to confirm or dismiss", async () => {
    suggestions = [suggestion("s1", "merge", "onion", "shallot", "onion")];
    render(<IngredientsSettingsContent />);
    const notice = within(await open("onion")).getByTestId("ingredient-suggestion-notice");

    expect(notice).toHaveTextContent("suggestion.merge");
    await act(async () => {
      fireEvent.click(within(notice).getByTestId("ingredient-suggestion-confirm"));
    });
    expect(mutations.confirmSuggestions).toHaveBeenCalledWith({ suggestionIds: ["s1"] });
    expect(mutations.merge).not.toHaveBeenCalled();
  });

  it("shows a round someone else is running, and offers no second one meanwhile", () => {
    runningRound = {
      jobId: "theirs",
      done: 2,
      total: 5,
      counts: { merge: 1, parent: 0, distinct: 1, unsure: 0, skipped: 0, failed: 0 },
      pending: ["onion", "x", "y"],
      finished: false,
    };
    report = {
      jobId: "theirs",
      finished: false,
      entries: [],
      waiting: [
        { ingredientId: "onion", name: "uitjes" },
        { ingredientId: "x", name: "Unox Knaks" },
        { ingredientId: "y", name: "AH pesto" },
      ],
    };
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-reviewing")).toBeInTheDocument();
    expect(screen.queryByTestId("ingredients-ask-ai-all")).toBeNull();
    // Its progress opens what it has done so far, and, folded, what it has still to ask.
    fireEvent.click(screen.getByTestId("ingredients-round-progress"));
    const panel = screen.getByRole("dialog", { name: "suggestionsTitle" });
    const progress = within(panel).getByTestId("ingredients-round");

    expect(within(progress).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(progress).toHaveTextContent("roundSection.progress");
    expect(within(panel).queryByRole("button", { name: "Unox Knaks" })).toBeNull();
    fireEvent.click(within(progress).getByRole("button", { name: /roundSection.waiting/ }));
    expect(within(panel).getByRole("button", { name: "Unox Knaks" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "AH pesto" })).toBeInTheDocument();

    act(() => {
      review.onEvent?.({ ...(runningRound as object), done: 5, pending: [], finished: true });
    });

    // Not this tab's round: the rows settled, and that is the whole message.
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ingredient-reviewing")).toBeNull();
    expect(screen.queryByTestId("ingredients-round-progress")).toBeNull();
    expect(screen.getByTestId("ingredients-ask-ai-all")).toBeEnabled();
  });

  it("reads what a round has written down as it goes, not only when it ends", () => {
    runningRound = {
      jobId: "theirs",
      done: 0,
      total: 40,
      counts: { merge: 0, parent: 0, distinct: 0, unsure: 0, skipped: 0, failed: 0 },
      pending: ["onion"],
      finished: false,
    };
    render(<IngredientsSettingsContent />);
    invalidateQueries.mockClear();

    act(() => {
      review.onEvent?.({ ...(runningRound as object), done: 20, pending: ["onion"] });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["ingredients.suggestions"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["ingredients.list"] });
    expect(screen.getByTestId("ingredients-round-progress")).toBeInTheDocument();
  });

  it("locks a food's panel while a round of Ask AI is asking about it", async () => {
    runningRound = {
      jobId: "theirs",
      done: 0,
      total: 1,
      counts: { merge: 0, parent: 0, distinct: 0, unsure: 0, skipped: 0, failed: 0 },
      pending: ["onion"],
      finished: false,
    };
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    // The panel says so with the row's own chip.
    expect(within(opened).getByTestId("ingredient-reviewing")).toBeInTheDocument();
    expect(within(opened).getByTestId("ingredient-name-input")).toBeDisabled();
    expect(within(opened).getByTestId("ingredient-set-parent")).toBeDisabled();
    expect(within(opened).getByTestId("ingredient-mark-distinct")).toBeDisabled();
    await showSpellings(opened);
    expect(screen.getByTestId("ingredient-alias-input")).toBeDisabled();
  });

  it("offers nothing of AI while AI is off for the instance", async () => {
    permissions.isAIEnabled = false;
    try {
      render(<IngredientsSettingsContent />);

      expect(screen.queryByTestId("ingredients-ask-ai-all")).toBeNull();
      const opened = await open("onion");

      expect(within(opened).getByTestId("ingredient-flag-notice")).toBeInTheDocument();
      expect(within(opened).queryByTestId("ingredient-ask-ai")).toBeNull();
      expect(within(opened).queryByTestId("ingredient-find-parent")).toBeNull();
      expect(within(opened).getByTestId("ingredient-mark-distinct")).toBeInTheDocument();
    } finally {
      permissions.isAIEnabled = true;
    }
  });

  it("puts a parent read from the food's own name to the viewer, in place rather than as a draft", async () => {
    items = [{ ...onion, name: "garlic cloves", parent: { id: "garlic", name: "garlic" } }, salt];
    suggestions = [suggestion("s1", "parent", "garlic cloves", "garlic", "onion", "words")];
    render(<IngredientsSettingsContent />);
    const opened = await open("garlic cloves");

    const notice = within(opened).getByTestId("ingredient-suggestion-notice");

    expect(notice).toHaveAttribute("data-source", "words");
    expect(notice).toHaveTextContent("suggestion.filedFromName");
    expect(notice).not.toHaveTextContent("aiTrace.");
    // The parent is the saved one, not a draft marked as AI's.
    expect(within(opened).queryByTestId("ingredient-parent-suggested")).toBeNull();

    await act(async () => {
      fireEvent.click(within(notice).getByTestId("ingredient-suggestion-dismiss"));
    });

    expect(mutations.dismissSuggestions).toHaveBeenCalledWith({ suggestionIds: ["s1"] });
  });

  it("offers the suggestions only while some wait on the viewer", async () => {
    // The server lists only what the viewer may answer: with none, nothing is offered.
    const { rerender } = render(<IngredientsSettingsContent />);

    expect(screen.queryByTestId("ingredients-suggestions-open")).toBeNull();

    suggestions = [
      suggestion("s1", "merge", "uitjes", "onion"),
      suggestion("s2", "parent", "red onion", "onion"),
    ];
    rerender(<IngredientsSettingsContent />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-suggestions-open"));
    });
    const shown = screen.getByRole("dialog", { name: "suggestionsTitle" });

    for (const row of within(shown).getAllByTestId("ingredient-suggestion")) {
      expect(within(row).getByTestId("ingredient-suggestion-confirm")).toBeInTheDocument();
    }
    await act(async () => {
      fireEvent.click(within(shown).getByTestId("ingredient-suggestions-confirm-all"));
    });
    expect(mutations.confirmSuggestions).toHaveBeenCalledWith({ suggestionIds: ["s1", "s2"] });
  });

  it("answers hundreds at once in one pass over the lists, not one pass each", async () => {
    const kinds = ["merge", "parent", "distinct"] as const;

    suggestions = Array.from({ length: 300 }, (_, index) =>
      suggestion(`s${index}`, kinds[index % 3]!, `food ${index}`, "onion")
    );
    const ids = suggestions.map((it) => (it as { id: string }).id);

    render(<IngredientsSettingsContent />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-suggestions-open"));
    });
    const shown = screen.getByRole("dialog", { name: "suggestionsTitle" });

    setQueriesData.mockClear();
    await act(async () => {
      fireEvent.click(within(shown).getByTestId("ingredient-suggestions-confirm-all"));
    });

    expect(mutations.confirmSuggestions).toHaveBeenCalledWith({ suggestionIds: ids });
    // Answered, they left the list at once.
    expect(suggestions).toEqual([]);
    // The suggestions once, then the list, the folded kinds and an open food's own read: once each.
    expect(setQueriesData).toHaveBeenCalledTimes(4);
  });

  it("opens a food's own panel from its name in the suggestions, over them", async () => {
    suggestions = [suggestion("s1", "merge", "uitjes", "onion")];
    // The list does not list uitjes, so its panel reads the food on its own.
    ownItem = { ...onion, id: "uitjes", name: "uitjes" };
    report = {
      jobId: "round-1",
      finished: true,
      entries: [
        { ingredientId: "knaks", name: "Unox Knaks", outcome: "failed", error: "Failed query" },
        { ingredientId: "gone", name: "Gone", outcome: "skipped", reason: "not-found" },
      ],
    };
    render(<IngredientsSettingsContent />);
    fireEvent.click(screen.getByTestId("ingredients-ask-ai-all"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ask-ai-start"));
    });
    act(() => {
      review.onEvent?.({
        jobId: "round-1",
        done: 1,
        total: 1,
        counts: { merge: 1, parent: 0, distinct: 0, unsure: 0, skipped: 1, failed: 1 },
        pending: [],
        finished: true,
      });
    });
    const shown = screen.getByRole("dialog", { name: "suggestionsTitle" });
    const [failed, gone] = within(shown).getAllByTestId("ingredients-review-entry");

    // A food the round got nothing for opens too, unless it is gone.
    expect(within(failed!).getByTestId("ingredient-suggestion-open")).toHaveTextContent(
      "Unox Knaks"
    );
    expect(within(gone!).queryByTestId("ingredient-suggestion-open")).toBeNull();

    await act(async () => {
      fireEvent.click(
        within(within(shown).getByTestId("ingredient-suggestion")).getByTestId(
          "ingredient-suggestion-open"
        )
      );
    });

    // The food's panel opens over the suggestions, with what AI suggests at its top.
    const opened = screen.getByRole("dialog", { name: "uitjes" });

    expect(within(opened).getByTestId("ingredient-suggestion-notice")).toHaveTextContent(
      "suggestion.merge"
    );
    expect(screen.getByRole("dialog", { name: "suggestionsTitle" })).toBeInTheDocument();
  });

  it("offers no AI round where nothing on screen is flagged", () => {
    items = [salt];
    render(<IngredientsSettingsContent />);

    expect(screen.queryByTestId("ingredients-ask-ai-all")).toBeNull();
  });

  it("keeps the panel of a food a filter no longer lists, and closes it once merged away", async () => {
    const { rerender } = render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    // Marked distinct under the flagged filter, the row goes; the panel stays.
    items = [salt];
    rerender(<IngredientsSettingsContent />);
    expect(screen.getByRole("dialog", { name: "onion" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-merge"));
    });
    const asking = screen.getByRole("dialog", { name: "mergeInto" });

    await act(async () => {
      fireEvent.click(within(asking).getByText("pick-salt"));
    });
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the panel current once a filter no longer lists the food", async () => {
    const { rerender } = render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    expect(within(opened).getByTestId("ingredient-flag-notice")).toBeInTheDocument();
    expect(within(opened).getByTestId("ingredient-find-parent")).toBeInTheDocument();
    expect(within(opened).getByTestId("ingredient-flagged")).toHaveTextContent("flagged");

    // Given a parent under the flagged filter, the row goes and the flag with it:
    // the panel reads the food on its own and shows it as it now is.
    items = [salt];
    ownItem = { ...onion, flagged: false, parent: { id: "vegetable", name: "vegetable" } };
    rerender(<IngredientsSettingsContent />);

    const current = screen.getByRole("dialog", { name: "onion" });

    expect(within(current).queryByTestId("ingredient-flag-notice")).toBeNull();
    expect(within(current).queryByTestId("ingredient-find-parent")).toBeNull();
    expect(within(current).getByTestId("ingredient-parent")).toHaveTextContent("vegetable");
  });

  it("closes the panel of a food once it is deleted", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });

    expect(screen.queryByRole("dialog", { name: "onion" })).toBeNull();
  });

  it("credits the catalogue's source and offers it as a download", () => {
    render(<IngredientsSettingsContent />);

    expect(screen.getByTestId("data-sources")).toHaveTextContent("notice");
    expect(screen.getByTestId("catalogue-export")).toHaveAttribute("href", "/export/ingredients");
  });

  it("says when nothing is flagged", () => {
    items = [];
    render(<IngredientsSettingsContent />);

    expect(screen.getByTestId("ingredients-empty")).toHaveTextContent("empty");
  });
});
