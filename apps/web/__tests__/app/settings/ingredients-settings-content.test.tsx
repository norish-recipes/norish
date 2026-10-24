/**
 * The Ingredients page: every food folded to a line, the flagged ones
 * marked, and a panel per food holding its spellings and only the actions
 * the server says the viewer may take.
 */
import { useSyncExternalStore } from "react";
import IngredientsSettingsContent from "@/app/(app)/settings/ingredients/components/ingredients-settings-content";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  keepAIChange: vi.fn(async () => ({ success: true })),
  undoAIChange: vi.fn(async () => ({ success: true })),
};
const invalidateQueries = vi.fn();
/**
 * The cache as the page patches it before the server answers: the list's
 * rows and AI's changes, written back so the next render shows them.
 */
const setQueriesData = vi.fn(
  ({ queryKey }: { queryKey: unknown[] }, update: (data: unknown) => unknown) => {
    if (queryKey[0] === "ingredients.list") {
      const next = update({ pages: [{ items, nextCursor: null }], pageParams: [] }) as {
        pages: Array<{ items: Item[] }>;
      };

      items = next.pages[0]!.items;
    }
    if (queryKey[0] === "ingredients.aiChanges") {
      changes = update(changes) as unknown[];
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
/** What AI changed, as `aiChanges` answers. */
let changes: unknown[] = [];
/** What `uses` answers: where the open food is still used. */
let uses: unknown = undefined;
/** Whether `uses` is still being read. */
let usesPending = false;
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
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      pathKey: () => ["ingredients"],
      aiChanges: {
        queryOptions: () => ({ queryKey: ["ingredients.aiChanges"] }),
        pathKey: () => ["ingredients.aiChanges"],
      },
      keepAIChange: { mutationOptions: () => ({ name: "keepAIChange" }) },
      undoAIChange: { mutationOptions: () => ({ name: "undoAIChange" }) },
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
      uses: {
        queryOptions: (input: unknown) => ({ queryKey: ["ingredients.uses", input] }),
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
      kinds: {
        queryOptions: (input: { parentId: string }) => ({ queryKey: ["ingredients.kinds", input] }),
        pathKey: () => ["ingredients.kinds"],
      },
    },
  }),
}));

// jsdom lays nothing out, so a panel's scrolling body is 0 tall and the
// Changed by AI's virtualised list would show no row: here it shows them all.
vi.mock("@tanstack/react-virtual", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-virtual")>()),
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: 0, size: 0 })),
    getTotalSize: () => 0,
    measureElement: () => undefined,
  }),
}));

vi.mock("@norish/shared-react/realtime", () => ({ useRealtimeSubscription: () => undefined }));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: ({ enabled: asked, queryKey }: { enabled?: boolean; queryKey: unknown[] }) => {
    // As react-query: a query without `enabled` runs.
    const enabled = asked !== false;

    useSyncExternalStore(cache.subscribe, cache.snapshot);
    switch (queryKey[0]) {
      case "ingredients.get":
        return { data: enabled ? ownItem : undefined, isFetching: false, isPending: false };
      case "ingredients.uses":
        return { data: enabled ? uses : undefined, isFetching: false, isPending: usesPending };
      case "ingredients.aiChanges":
        return { data: changes, isFetching: false, isPending: false };
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
vi.mock("@/lib/ui/action-toast", () => ({ showActionToast: vi.fn() }));
/** Whether the instance can draw icons. */
const permissions = vi.hoisted(() => ({ isAIEnabled: true, canDrawImages: false }));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(() => ({
    hiddenItems: [],
  }))
);

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

  return { default: Panel, PanelPortal: ({ children }: { children: React.ReactNode }) => children };
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

/** What AI changed about the food `name`, sure or not, as Changed by AI lists it. */
function change(
  id: string,
  kind: "merge" | "parent" | "plain-name" | "not-a-food" | "spelling",
  name: string,
  {
    sure = true,
    from = null,
    target = null,
    dropped = null,
    ingredientId = name,
  }: {
    sure?: boolean;
    from?: string | null;
    target?: string | null;
    dropped?: string | null;
    ingredientId?: string;
  } = {}
) {
  return {
    id,
    kind,
    sure,
    kept: false,
    createdAt: new Date(0),
    ingredient: { id: ingredientId, name, localeNames: {} },
    target: target ? { id: target, name: target, localeNames: {} } : null,
    dropped: dropped ? { id: dropped, name: dropped, localeNames: {} } : null,
    from,
    canAct: true,
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
    uses = undefined;
    usesPending = false;
    permissions.canDrawImages = false;
    changes = [];
    ownItem = undefined;
    kinds = {};
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

  it("shows each food's icon in its row, and the food glyph for one with none", () => {
    const icon = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";

    items = [{ ...onion, icon, ownIcon: true }, salt];
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-icon").getAttribute("src")).toBe(icon);
    expect(within(row("salt")).queryByTestId("ingredient-icon")).toBeNull();
    expect(within(row("salt")).getByTestId("ingredient-icon-placeholder")).toBeInTheDocument();
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

  it("offers the cross on a spelling the viewer may remove, whatever uses it", async () => {
    items = [{ ...onion, aliases: [{ id: "a-onion", text: "onion", canRemove: true }] }];
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await showSpellings(opened);

    expect(within(opened).getByRole("button", { name: "removeAlias" })).toBeInTheDocument();
    expect(within(opened).getByTestId("ingredient-alias-move")).toBeInTheDocument();
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
      junk: [],
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
    mutations.remove.mockRejectedValueOnce(new Error("forbidden"));
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
        description: "errors.forbidden",
        context: "ingredients:delete",
      })
    );
  });

  it("says what a delete touches before it is confirmed, and opens where", async () => {
    uses = {
      recipes: [{ id: "r1", name: "Saté" }],
      groceries: [{ name: "onions", done: true, recurring: false }],
      pantry: true,
      elsewhere: 2,
      counts: { recipeLines: 3, groceries: 0, pantry: 1 },
    };
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });

    const touches = screen.getByTestId("ingredient-delete-touches");

    // Only what it touches: no groceries use this one.
    expect(
      within(touches)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["deleteTouches.recipeLines", "deleteTouches.pantry"]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "uses.show" }));
    });

    expect(mutations.remove).not.toHaveBeenCalled();
    const where = screen.getByTestId("ingredient-uses");

    expect(within(where).getByRole("link", { name: "Saté" })).toHaveAttribute(
      "href",
      "/recipes/r1"
    );
    expect(where).toHaveTextContent("onions · done");
    expect(where).toHaveTextContent("pantry");
    expect(where).toHaveTextContent("elsewhere");
  });

  it("offers the plain Delete on a food AI says is not a food, its lines keeping their text", async () => {
    uses = {
      recipes: [],
      groceries: [],
      pantry: true,
      elsewhere: 0,
      counts: { recipeLines: 2, groceries: 0, pantry: 1 },
    };
    items = [{ ...onion, name: "melted", flagReason: "ai-junk" }, salt];
    render(<IngredientsSettingsContent />);
    const opened = await open("melted");

    expect(within(opened).getByTestId("ingredient-flag-notice")).toHaveTextContent(
      "flagReasons.ai-junk"
    );
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });

    expect(screen.getByTestId("ingredient-delete-dialog")).toHaveTextContent("deleteTitle");
    expect(screen.getByTestId("ingredient-delete-touches")).toHaveTextContent(
      "deleteTouches.recipeLines"
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });

    expect(mutations.remove).toHaveBeenCalledWith({ ingredientId: "onion" });
  });

  it("says on Changed by AI that AI removed a translation, or moved it to another food", async () => {
    changes = [
      change("c1", "spelling", "chicken breast", { from: "boneless" }),
      change("c2", "spelling", "chicken breast", { from: "kippendijen", target: "chicken thigh" }),
    ];
    render(<IngredientsSettingsContent />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    const [removed, moved] = within(
      screen.getByRole("dialog", { name: "changedByAI.title" })
    ).getAllByTestId("ingredient-ai-change");

    expect(removed).toHaveTextContent("changedByAI.spellingRemoved");
    expect(moved).toHaveTextContent("changedByAI.spellingMoved");
  });

  it("lists a food AI deleted as not a food by its name on Changed by AI, with Undo", async () => {
    changes = [{ ...change("c1", "not-a-food", "melted"), ingredient: null, from: "melted" }];
    render(<IngredientsSettingsContent />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    const [deleted] = within(
      screen.getByRole("dialog", { name: "changedByAI.title" })
    ).getAllByTestId("ingredient-ai-change");

    expect(deleted).toHaveTextContent("melted");
    expect(deleted).toHaveTextContent("changedByAI.notAFood");
    expect(within(deleted!).queryByTestId("ingredient-ai-change-open")).toBeNull();
    await act(async () => {
      fireEvent.click(within(deleted!).getByTestId("ingredient-ai-change-undo"));
    });
    expect(mutations.undoAIChange).toHaveBeenCalledWith({ changeId: "c1" });
  });

  it("holds Delete until it has read what the delete touches", async () => {
    usesPending = true;
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });

    expect(screen.getByTestId("ingredient-delete-confirm")).toBeDisabled();
    await act(async () => {
      uses = {
        recipes: [],
        groceries: [],
        pantry: false,
        elsewhere: 0,
        counts: { recipeLines: 0, groceries: 0, pantry: 0 },
      };
      usesPending = false;
      cache.changed();
    });

    expect(screen.getByTestId("ingredient-delete-confirm")).toBeEnabled();
  });

  it("adds a household's own spelling clean, staged until Save", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("salt");
    await showSpellings(opened);
    const field = within(opened).getByTestId("ingredient-alias-input");

    await act(async () => {
      fireEvent.change(field, { target: { value: " zout ((fijn)) " } });
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
      junk: [],
    });
  });

  it("removes a spelling on Save, and keeps one un-removed before it", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    await showSpellings(opened);
    const remove = async () => {
      fireEvent.click(within(opened).getByRole("button", { name: "removeAlias" }));
      await act(async () => {
        fireEvent.click(await screen.findByTestId("ingredient-junk-remove"));
      });
    };

    await remove();
    // Marked for removal, the chip stays, struck through, with a way back.
    expect(within(opened).getAllByTestId("ingredient-alias")[0]).toHaveAttribute(
      "data-pending",
      "removed"
    );
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    fireEvent.click(within(opened).getByRole("button", { name: "keepAlias" }));
    expect(within(opened).getByTestId("ingredient-save")).toBeDisabled();

    await remove();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      add: [],
      remove: ["a-onion"],
      junk: [],
    });
  });

  it("asks whether a spelling removed by hand names no food: yes marks it for the junk pile, closing stages nothing", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    await showSpellings(opened);
    const cross = () => within(opened).getByRole("button", { name: "removeAlias" });

    fireEvent.click(cross());
    expect(await screen.findByTestId("ingredient-junk-dialog")).toHaveTextContent("junkTitle");
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId("ingredient-junk-dialog"), { key: "Escape" });
    });
    await waitFor(() => expect(screen.queryByTestId("ingredient-junk-dialog")).toBeNull());
    expect(within(opened).getAllByTestId("ingredient-alias")[0]).not.toHaveAttribute(
      "data-pending"
    );

    fireEvent.click(cross());
    await act(async () => {
      fireEvent.click(await screen.findByTestId("ingredient-junk-mark"));
    });
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      add: [],
      remove: ["a-onion"],
      junk: ["a-onion"],
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
      junk: [],
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

  it("lists the foods with neither parent nor kinds on request", async () => {
    items = [{ ...onion, flagged: false, kinds: 0 }, salt];
    render(<IngredientsSettingsContent />);

    fireEvent.click(screen.getByTestId("ingredients-filters"));
    const filters = screen.getByRole("dialog", { name: "title" });

    fireEvent.click(within(filters).getByRole("switch", { name: "standaloneOnly" }));
    await act(async () => {
      fireEvent.click(within(filters).getByTestId("ingredients-filters-apply"));
    });

    expect(listInputs.at(-1)).toMatchObject({ standaloneOnly: true });
    expect(listInputs.at(-1)).not.toHaveProperty("rootsOnly", true);
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
      junk: [],
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

  it("says why a food is flagged, on the fold and in the panel, and asks no AI from either", async () => {
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
    // AI asks about a food by itself, in the background: the panel offers only Mark distinct.
    expect(within(opened).getByTestId("ingredient-mark-distinct")).toBeInTheDocument();
    expect(within(opened).queryByTestId("ingredient-ask-ai")).toBeNull();
    expect(within(opened).queryByTestId("ingredient-check-with-ai")).toBeNull();
    expect(screen.queryByTestId("ingredients-fix-catalogue")).toBeNull();
  });

  it("puts what AI was unsure of about a food at the top of its panel, to keep or undo", async () => {
    changes = [
      change("c1", "merge", "onion", { sure: false, from: "uitjes" }),
      change("c2", "parent", "onion", { target: "vegetable" }),
    ];
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    const [unsure, ...rest] = within(opened).getAllByTestId("ingredient-ai-change");

    // Only the unsure one: the sure one is Changed by AI's alone.
    expect(rest).toEqual([]);
    expect(unsure).toHaveTextContent("changedByAI.merge");
    await act(async () => {
      fireEvent.click(within(unsure!).getByTestId("ingredient-ai-change-undo"));
    });
    expect(mutations.undoAIChange).toHaveBeenCalledWith({ changeId: "c1" });
    expect(mutations.merge).not.toHaveBeenCalled();
  });

  it("says which parent AI took away, and undoes it", async () => {
    items = [{ ...onion, name: "peanut butter" }, salt];
    changes = [
      change("c1", "parent", "peanut butter", {
        sure: false,
        dropped: "butter",
        ingredientId: "onion",
      }),
    ];
    render(<IngredientsSettingsContent />);
    const opened = await open("peanut butter");
    const unsure = within(opened).getByTestId("ingredient-ai-change");

    expect(unsure).toHaveTextContent("changedByAI.parentDropped");
    await act(async () => {
      fireEvent.click(within(unsure).getByTestId("ingredient-ai-change-undo"));
    });

    expect(mutations.undoAIChange).toHaveBeenCalledWith({ changeId: "c1" });
  });

  it("offers Changed by AI only while AI changed something, saying how many to check", async () => {
    const { rerender } = render(<IngredientsSettingsContent />);

    expect(screen.queryByTestId("ingredients-ai-changes-open")).toBeNull();

    changes = [
      change("c1", "merge", "onion", { from: "uitjes" }),
      { ...change("c2", "parent", "red onion", { target: "onion" }), canAct: false },
    ];
    rerender(<IngredientsSettingsContent />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    const [mine, theirs] = within(
      screen.getByRole("dialog", { name: "changedByAI.title" })
    ).getAllByTestId("ingredient-ai-change");

    // A change the viewer may not undo is listed all the same, with nothing to press.
    expect(within(mine!).getByTestId("ingredient-ai-change-undo")).toBeInTheDocument();
    expect(within(theirs!).queryByTestId("ingredient-ai-change-undo")).toBeNull();
  });

  it("opens a food's own panel from its name in Changed by AI, over it", async () => {
    changes = [change("c1", "merge", "uitjes", { sure: false, from: "onions" })];
    // The list does not list uitjes, so its panel reads the food on its own.
    ownItem = { ...onion, id: "uitjes", name: "uitjes" };
    render(<IngredientsSettingsContent />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    const shown = screen.getByRole("dialog", { name: "changedByAI.title" });

    await act(async () => {
      fireEvent.click(
        within(within(shown).getByTestId("ingredient-ai-change")).getByTestId(
          "ingredient-ai-change-open"
        )
      );
    });

    // The food's panel opens over Changed by AI, with what AI was unsure of at its top.
    const opened = screen.getByRole("dialog", { name: "uitjes" });

    expect(within(opened).getByTestId("ingredient-ai-change")).toHaveTextContent(
      "changedByAI.merge"
    );
    expect(screen.getByRole("dialog", { name: "changedByAI.title" })).toBeInTheDocument();
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
    expect(within(opened).getByTestId("ingredient-flagged")).toHaveTextContent("flagged");

    // Given a parent under the flagged filter, the row goes and the flag with it:
    // the panel reads the food on its own and shows it as it now is.
    items = [salt];
    ownItem = { ...onion, flagged: false, parent: { id: "vegetable", name: "vegetable" } };
    rerender(<IngredientsSettingsContent />);

    const current = screen.getByRole("dialog", { name: "onion" });

    expect(within(current).queryByTestId("ingredient-flag-notice")).toBeNull();
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
