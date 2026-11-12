/**
 * The Ingredients page: every food folded to a line, the flagged ones
 * marked, and a panel per food holding its spellings and only the actions
 * the server says the viewer may take. It runs over the catalogue's hooks
 * and a real query cache, against a fake server.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { readAnswers, sentReads, writeAnswers } from "@/__tests__/helpers/trpc-fake";
import { IngredientsScreen } from "@/features/ingredients/ingredients-screen";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIChange } from "@norish/shared-react/ingredients";
import type { PlatformAdapter } from "@norish/shared-react/platform";

import "@testing-library/jest-dom";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

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

/** The server's catalogue, which its writes change as the real one would. */
let items: Item[] = [];
let everySpelling: Item["aliases"] = [];
const listInputs: unknown[] = [];
/** What AI changed, as `aiChanges` answers. */
let changes: AIChange[] = [];
/** What `uses` answers: where the open food is still used. */
let uses: unknown;
/** Holds the `uses` read until a test lets it answer. */
let usesHeld: Promise<void> | null = null;
/** What `get` answers for a food the list no longer lists. */
let ownItem: unknown = undefined;
/** What `kinds` answers per parent, for the rows folded out under it. */
let kinds: Record<string, Item[]> = {};
/** How many more pages the list runs on to after the one read. */
let pagesLeft = 0;
/** Holds every list read from now on, as a slow server does. */
let listStalled = false;

const ok = { success: true as const };
const mutations = {
  saveDraft: vi.fn(async (_input: unknown) => ok),
  markDistinct: vi.fn(async ({ ingredientId }: { ingredientId: string }) => {
    items = items.map((item) => (item.id === ingredientId ? { ...item, flagged: false } : item));

    return ok;
  }),
  merge: vi.fn(async ({ sourceId }: { sourceId: string; targetId: string }) => {
    items = items.filter((item) => item.id !== sourceId);

    return ok;
  }),
  moveAlias: vi.fn(async (_input: unknown) => ok),
  remove: vi.fn(async ({ ingredientId }: { ingredientId: string }) => {
    items = items.filter((item) => item.id !== ingredientId);

    return ok;
  }),
  keepAIChange: vi.fn(async ({ changeId }: { changeId: string }) => {
    changes = changes.map((it) => (it.id === changeId ? { ...it, kept: true } : it));

    return ok;
  }),
  undoAIChange: vi.fn(async ({ changeId }: { changeId: string }) => {
    changes = changes.filter((it) => it.id !== changeId);

    return ok;
  }),
  settleAIChanges: vi.fn(async ({ how, changeIds }: { how: string; changeIds: string[] }) => {
    changes =
      how === "keep"
        ? changes.map((it) => (changeIds.includes(it.id) ? { ...it, kept: true } : it))
        : changes.filter((it) => !changeIds.includes(it.id));

    return ok;
  }),
  clearAIChanges: vi.fn(async () => {
    changes = changes.filter((it) => !it.sure && !it.kept);

    return ok;
  }),
};

const never = () => new Promise<never>(() => {});

function serve() {
  readAnswers.clear();
  writeAnswers.clear();
  readAnswers.set("ingredients.list", async (input) => {
    listInputs.push(input);
    if (listStalled) return never();

    return { items, nextCursor: pagesLeft-- > 0 ? 1 : null };
  });
  readAnswers.set("ingredients.aiChanges", async () => changes);
  readAnswers.set("ingredients.get", async () => ownItem ?? null);
  readAnswers.set("ingredients.spellings", async () => everySpelling);
  readAnswers.set(
    "ingredients.kinds",
    async (input) => kinds[(input as { parentId: string }).parentId] ?? []
  );
  readAnswers.set("ingredients.uses", async () => {
    await usesHeld;

    return uses;
  });
  for (const [name, write] of Object.entries(mutations)) {
    writeAnswers.set(`ingredients.${name}`, (input) =>
      (write as (input: unknown) => Promise<unknown>)(input)
    );
  }
}

/** How many times the list was read. */
const listReads = () => sentReads.mock.calls.filter(([path]) => path === "ingredients.list").length;

let queryClient: QueryClient;
let platform: PlatformAdapter;

/** The page over a fresh cache, once its first reads have answered. */
async function renderScreen() {
  const view = render(<IngredientsScreen />, { wrapper: createTestWrapper(queryClient, platform) });

  await settle();

  return view;
}

/** Waits until no read is on its way. */
async function settle() {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
}

/** The server's catalogue changed: the page reads it again, as an event would make it. */
async function reread() {
  await act(async () => {
    await queryClient.invalidateQueries();
  });
  await settle();
}

/** The end of the list's observer, so a test can bring it into view. */
const listEnd = vi.hoisted(() => ({
  onIntersect: undefined as ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined,
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

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

vi.mock("@/lib/ui/action-toast", () => ({ showActionToast: vi.fn() }));
/** Whether the instance can draw icons. */
const permissions = vi.hoisted(() => ({ isAIEnabled: true, canDrawImages: false }));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(
    () => ({
      hiddenItems: [],
    }),
    {
      reader: () => ({ permissions }),
    }
  )
);

vi.mock("@heroui/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heroui/react")>()),
  toast: Object.assign(vi.fn(), { close: vi.fn() }),
}));

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
    "data-testid": testId,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    "data-testid"?: string;
  }) => (
    <button data-testid={testId} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children, start }: { children?: ReactNode; start?: ReactNode }) => (
    <div>
      {start}
      {children}
    </div>
  ),
  IconActionButton: ({
    label,
    onPress,
    action,
    isDisabled,
    "data-testid": testId,
  }: {
    label: string;
    onPress?: () => void;
    action: string;
    isDisabled?: boolean;
    "data-testid"?: string;
  }) => (
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
  const Panel = ({
    children,
    open,
    title,
    titleAddon,
  }: {
    children?: ReactNode;
    open?: boolean;
    title?: string;
    titleAddon?: ReactNode;
  }) =>
    open ? (
      <div aria-label={title} role="dialog">
        {titleAddon}
        {children}
      </div>
    ) : null;

  Panel.Body = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: ReactNode }) => children };
});

// A food's nutrition and its corrections are the nutrition section's own tests' business.
// The panel's Pantry row reads the household's Pantry and groceries; the
// browser spec walks it, so here it is a household that keeps nothing.
vi.mock("@norish/shared-react/config", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useIngredientsSubscription: () => undefined,
  useSpellingRules: () => undefined,
}));
vi.mock("@/hooks/use-groceries-pantry-and-catalogue-subscriptions", () => ({
  useGroceriesPantryAndCatalogueSubscriptions: () => undefined,
}));
vi.mock("@norish/shared-react/groceries", () => ({
  usePantryItem: () => null,
  usePantryMutations: () => ({ addPantryIngredient: vi.fn(), removePantryIngredient: vi.fn() }),
  useOnTheList: () => [],
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
  IngredientPicker: ({
    onPick,
    editableOnly,
    excludeId,
  }: {
    onPick: (pick: { id: string; name: string }) => void;
    editableOnly?: boolean;
    excludeId?: string;
  }) => (
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
): AIChange {
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
  await settle();

  return panel(name);
}

/** The spellings sit behind a row of their own, in a panel over the food's. */
async function showSpellings(opened: HTMLElement) {
  await act(async () => {
    fireEvent.click(within(opened).getByTestId("ingredient-all-spellings"));
  });
  await settle();
}

describe("IngredientsScreen", () => {
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
    pagesLeft = 0;
    listStalled = false;
    viewerLocale = "en";
    listInputs.length = 0;
    items = [onion, salt];
    everySpelling = [];
    uses = {
      recipes: [],
      groceries: [],
      pantry: false,
      elsewhere: 0,
      counts: { recipeLines: 0, groceries: 0, pantry: 0 },
    };
    usesHeld = null;
    permissions.canDrawImages = false;
    changes = [];
    ownItem = undefined;
    kinds = {};
    sentReads.mockClear();
    for (const write of Object.values(mutations)) write.mockClear();
    serve();
    queryClient = createTestQueryClient();
    platform = fakePlatformAdapter();
  });

  it("asks for the next page once the end of the list comes into view, and again while it stays", async () => {
    pagesLeft = 2;
    await renderScreen();
    const before = listReads();

    expect(before).toBe(1);
    // Each page lands with the end still in reach: the next is asked until the last.
    act(() => {
      listEnd.onIntersect?.([{ isIntersecting: true }]);
    });
    await waitFor(() => expect(listReads()).toBe(3));
    await settle();
    expect(listReads()).toBe(3);
  });

  it("settles only while another search's rows stand in, not while the rows showing are read again", async () => {
    const busy = () => screen.getByTestId("ingredients-searching").getAttribute("data-fetching");

    await renderScreen();
    listStalled = true;
    act(() => {
      void queryClient.invalidateQueries();
    });
    await waitFor(() => expect(queryClient.isFetching()).toBeGreaterThan(0));
    expect(busy()).toBe("false");

    act(() => {
      fireEvent.change(screen.getByTestId("ingredients-search"), { target: { value: "oni" } });
    });
    await waitFor(() => expect(busy()).toBe("true"));
  });

  it("shows a changed filter's loading state, never the empty copy, while its first answer is on its way", async () => {
    items = [];
    await renderScreen();
    expect(screen.getByTestId("ingredients-empty")).toBeInTheDocument();

    items = [onion];
    listStalled = true;
    act(() => {
      fireEvent.change(screen.getByTestId("ingredients-search"), { target: { value: "oni" } });
    });
    await waitFor(() => expect(listReads()).toBe(2));

    expect(screen.queryByTestId("ingredients-empty")).toBeNull();
    expect(screen.getByTestId("ingredients-loading")).toHaveAttribute("aria-busy", "true");
  });

  it("says a changed filter found nothing Offline, where its unread answer is paused, not loading", async () => {
    items = [];
    await renderScreen();
    onlineManager.setOnline(false);
    try {
      act(() => {
        fireEvent.change(screen.getByTestId("ingredients-search"), { target: { value: "oni" } });
      });

      await waitFor(() => expect(screen.getByTestId("ingredients-empty")).toBeInTheDocument());
      expect(screen.queryByTestId("ingredients-loading")).toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("marks the previous filter's rows as loading while the changed filter is read", async () => {
    await renderScreen();
    listStalled = true;
    act(() => {
      fireEvent.change(screen.getByTestId("ingredients-search"), { target: { value: "oni" } });
    });
    await waitFor(() => expect(listReads()).toBe(2));

    expect(screen.getByTestId("ingredients-list")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("ingredients-list")).toHaveClass("opacity-60");
  });

  it("shows each food's icon in its row, and the food glyph for one with none", async () => {
    const icon = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";

    items = [{ ...onion, icon, ownIcon: true }, salt];
    await renderScreen();

    expect(within(row("onion")).getByTestId("ingredient-icon").getAttribute("src")).toBe(icon);
    expect(within(row("salt")).queryByTestId("ingredient-icon")).toBeNull();
    expect(within(row("salt")).getByTestId("ingredient-icon-placeholder")).toBeInTheDocument();
  });

  it("lists each food on a line, marks the flagged ones, and opens one to its spellings", async () => {
    await renderScreen();

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

    await renderScreen();

    expect(await screen.findByRole("dialog", { name: "onion" })).toBeInTheDocument();
  });

  it("offers only what the viewer may do", async () => {
    await renderScreen();
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
    await renderScreen();
    const opened = await open("onion");

    await showSpellings(opened);

    expect(within(opened).getByRole("button", { name: "removeAlias" })).toBeInTheDocument();
    expect(within(opened).getByTestId("ingredient-alias-move")).toBeInTheDocument();
  });

  it("marks a flagged food distinct", async () => {
    await renderScreen();
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-mark-distinct"));
    });
    await settle();

    expect(mutations.markDistinct).toHaveBeenCalledWith({ ingredientId: "onion" });
    // Landed, the list is read again: the row is the server's, unflagged.
    await settle();
    expect(within(row("onion")).queryByTestId("ingredient-flagged")).toBeNull();
  });

  it("renames a food from its name field, saved with the panel's Save", async () => {
    await renderScreen();
    const before = listReads();
    const opened = await open("onion");
    const field = within(opened).getByTestId("ingredient-name-input");

    // Nothing to save until something differs.
    expect(within(opened).getByTestId("ingredient-save")).toBeDisabled();

    await act(async () => {
      fireEvent.change(field, { target: { value: "Onion" } });
    });
    await settle();

    expect(mutations.saveDraft).not.toHaveBeenCalled();
    expect(within(opened).getByTestId("ingredient-save")).toBeEnabled();

    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    await settle();

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      name: "Onion",
      add: [],
      remove: [],
      junk: [],
    });
    await settle();
    expect(listReads()).toBeGreaterThan(before);
  });

  it("deletes a food once the viewer confirms", async () => {
    // The server has not answered yet.
    mutations.remove.mockImplementationOnce(never);
    await renderScreen();
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await settle();

    expect(mutations.remove).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });
    await settle();

    expect(mutations.remove).toHaveBeenCalledWith({ ingredientId: "onion" });
    // The row is gone the moment the viewer confirms, not when the server answers.
    expect(screen.getAllByTestId("ingredient-row").map((r) => r.dataset.ingredient)).toEqual([
      "salt",
    ]);
  });

  it("shows a refused edit undone, and says why", async () => {
    mutations.remove.mockRejectedValueOnce(new Error("forbidden"));
    await renderScreen();
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });
    await settle();

    // The guess is read back from the server rather than kept.
    await settle();
    expect(row("onion")).toBeInTheDocument();
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "danger",
      title: "settings.ingredients.errors.title",
      description: "settings.ingredients.errors.forbidden",
    });
  });

  it("says what a delete touches before it is confirmed, and opens where", async () => {
    uses = {
      recipes: [{ id: "r1", name: "Saté" }],
      groceries: [{ name: "onions", done: true, recurring: false }],
      pantry: true,
      elsewhere: 2,
      counts: { recipeLines: 3, groceries: 0, pantry: 1 },
    };
    await renderScreen();
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await settle();

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
    await settle();

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
    await renderScreen();
    const opened = await open("melted");

    expect(within(opened).getByTestId("ingredient-flag-notice")).toHaveTextContent(
      "flagReasons.ai-junk"
    );
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await settle();

    expect(screen.getByTestId("ingredient-delete-dialog")).toHaveTextContent("deleteTitle");
    expect(screen.getByTestId("ingredient-delete-touches")).toHaveTextContent(
      "deleteTouches.recipeLines"
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });
    await settle();

    expect(mutations.remove).toHaveBeenCalledWith({ ingredientId: "onion" });
  });

  it("says on Changed by AI that AI removed a translation, or moved it to another food", async () => {
    changes = [
      change("c1", "spelling", "chicken breast", { from: "boneless" }),
      change("c2", "spelling", "chicken breast", { from: "kippendijen", target: "chicken thigh" }),
    ];
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    await settle();
    const [removed, moved] = within(
      screen.getByRole("dialog", { name: "changedByAI.title" })
    ).getAllByTestId("ingredient-ai-change");

    expect(removed).toHaveTextContent("changedByAI.spellingRemoved");
    expect(moved).toHaveTextContent("changedByAI.spellingMoved");
  });

  it("lists a food AI deleted as not a food by its name on Changed by AI, with Undo", async () => {
    changes = [{ ...change("c1", "not-a-food", "melted"), ingredient: null, from: "melted" }];
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    await settle();
    const [deleted] = within(
      screen.getByRole("dialog", { name: "changedByAI.title" })
    ).getAllByTestId("ingredient-ai-change");

    expect(deleted).toHaveTextContent("melted");
    expect(deleted).toHaveTextContent("changedByAI.notAFood");
    expect(within(deleted!).queryByTestId("ingredient-ai-change-open")).toBeNull();
    await act(async () => {
      fireEvent.click(within(deleted!).getByTestId("ingredient-ai-change-undo"));
    });
    await settle();
    expect(mutations.undoAIChange).toHaveBeenCalledWith({ changeId: "c1" });
  });

  it("reads a food's own read, spellings and uses only while what shows them is open", async () => {
    const reads = (path: string) => sentReads.mock.calls.filter(([read]) => read === path).length;

    items = [{ ...onion, hiddenSpellings: 2 }, salt];
    await renderScreen();
    const opened = await open("onion");

    expect([reads("ingredients.get"), reads("ingredients.spellings")]).toEqual([0, 0]);
    expect(reads("ingredients.uses")).toBe(0);

    await showSpellings(opened);
    expect(reads("ingredients.spellings")).toBe(1);

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await settle();
    expect(reads("ingredients.uses")).toBe(1);

    // The list drops the open food: only now is it read on its own.
    items = [salt];
    await reread();
    expect(reads("ingredients.get")).toBe(1);
  });

  it("reads a linked food on its own only while its panel is open", async () => {
    const reads = () => sentReads.mock.calls.filter(([read]) => read === "ingredients.get").length;

    linkedIngredient = "onion";
    items = [salt];
    ownItem = onion;
    await renderScreen();

    expect(await screen.findByRole("dialog", { name: "onion" })).toBeInTheDocument();
    expect(reads()).toBe(1);

    await act(async () => {
      fireEvent.click(within(panel("onion")).getByTestId("ingredient-delete"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });
    await settle();
    sentReads.mockClear();
    await reread();

    expect(screen.queryByRole("dialog", { name: "onion" })).toBeNull();
    expect(reads()).toBe(0);
  });

  it("holds Delete until it has read what the delete touches", async () => {
    let answer = () => {};

    usesHeld = new Promise((resolve) => (answer = resolve));
    await renderScreen();
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
      answer();
    });

    await waitFor(() => expect(screen.getByTestId("ingredient-delete-confirm")).toBeEnabled());
  });

  it("adds a household's own spelling clean, staged until Save", async () => {
    await renderScreen();
    const opened = await open("salt");
    await showSpellings(opened);
    const field = within(opened).getByTestId("ingredient-alias-input");

    await act(async () => {
      fireEvent.change(field, { target: { value: " zout ((fijn)) " } });
    });
    await settle();
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    await settle();

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
    await settle();

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "salt",
      add: ["zout"],
      remove: [],
      junk: [],
    });
  });

  it("removes a spelling on Save, and keeps one un-removed before it", async () => {
    await renderScreen();
    const opened = await open("onion");
    await showSpellings(opened);
    const remove = async () => {
      fireEvent.click(within(opened).getByRole("button", { name: "removeAlias" }));
      await act(async () => {
        fireEvent.click(await screen.findByTestId("ingredient-junk-remove"));
      });
      await settle();
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
    await settle();

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      add: [],
      remove: ["a-onion"],
      junk: [],
    });
  });

  it("asks whether a spelling removed by hand names no food: yes marks it for the junk pile, closing stages nothing", async () => {
    await renderScreen();
    const opened = await open("onion");
    await showSpellings(opened);
    const cross = () => within(opened).getByRole("button", { name: "removeAlias" });

    fireEvent.click(cross());
    expect(await screen.findByTestId("ingredient-junk-dialog")).toHaveTextContent("junkTitle");
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId("ingredient-junk-dialog"), { key: "Escape" });
    });
    await settle();
    await waitFor(() => expect(screen.queryByTestId("ingredient-junk-dialog")).toBeNull());
    expect(within(opened).getAllByTestId("ingredient-alias")[0]).not.toHaveAttribute(
      "data-pending"
    );

    fireEvent.click(cross());
    await act(async () => {
      fireEvent.click(await screen.findByTestId("ingredient-junk-mark"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });
    await settle();

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "onion",
      add: [],
      remove: ["a-onion"],
      junk: ["a-onion"],
    });
  });

  it("merges a food into one the viewer may edit, picked in a panel of its own", async () => {
    await renderScreen();
    const opened = await open("onion");

    expect(screen.queryByRole("dialog", { name: "mergeInto" })).toBeNull();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-merge"));
    });
    await settle();
    const asking = screen.getByRole("dialog", { name: "mergeInto" });
    const picker = within(asking).getByTestId("picker");

    expect(picker).toHaveAttribute("data-editable-only", "true");
    expect(picker).toHaveAttribute("data-exclude", "onion");
    expect(within(asking).queryByTestId("ingredient-relocation-new")).toBeNull();
    expect(within(asking).getByTestId("ingredient-relocation-confirm")).toBeDisabled();

    await act(async () => {
      fireEvent.click(within(picker).getByText("pick-salt"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });
    await settle();

    expect(mutations.merge).toHaveBeenCalledWith({ sourceId: "onion", targetId: "salt" });
    expect(screen.queryByRole("dialog", { name: "mergeInto" })).toBeNull();
  });

  it("moves a spelling out to a new food", async () => {
    await renderScreen();
    const opened = await open("onion");
    await showSpellings(opened);

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-alias-move"));
    });
    await settle();
    const asking = screen.getByRole("dialog", { name: "moveTo" });

    // Its own food is a button of its own, not a search result typing would filter away.
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-new"));
    });
    await settle();

    expect(mutations.moveAlias).toHaveBeenCalledWith({ aliasId: "a-onion", targetId: null });
  });

  it("sets the food a food is a kind of, from any Ingredient", async () => {
    await renderScreen();
    const opened = await open("onion");

    expect(within(opened).queryByTestId("ingredient-clear-parent")).toBeNull();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-set-parent"));
    });
    await settle();
    const asking = screen.getByRole("dialog", { name: "setParent" });
    const picker = within(asking).getByTestId("picker");

    expect(picker).toHaveAttribute("data-editable-only", "false");
    await act(async () => {
      fireEvent.click(within(picker).getByText("pick-salt"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });
    await settle();

    // Picked, the parent joins the draft; it lands with Save.
    expect(within(opened).getByTestId("ingredient-parent")).toHaveTextContent("salt");
    expect(mutations.saveDraft).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-save"));
    });
    await settle();

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
    await renderScreen();

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
    await settle();

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
    await renderScreen();

    fireEvent.click(screen.getByTestId("ingredients-filters"));
    const filters = screen.getByRole("dialog", { name: "title" });

    fireEvent.click(within(filters).getByRole("switch", { name: "asTree" }));
    await act(async () => {
      fireEvent.click(within(filters).getByTestId("ingredients-filters-apply"));
    });
    await settle();

    expect(listInputs.at(-1)).not.toHaveProperty("rootsOnly", true);
    expect(listInputs.at(-1)).not.toHaveProperty("tree");
    expect(within(row("onion")).queryByTestId("ingredient-kinds-toggle")).toBeNull();
  });

  it("lists the foods with neither parent nor kinds on request", async () => {
    items = [{ ...onion, flagged: false, kinds: 0 }, salt];
    await renderScreen();

    fireEvent.click(screen.getByTestId("ingredients-filters"));
    const filters = screen.getByRole("dialog", { name: "title" });

    fireEvent.click(within(filters).getByRole("switch", { name: "standaloneOnly" }));
    await act(async () => {
      fireEvent.click(within(filters).getByTestId("ingredients-filters-apply"));
    });
    await settle();

    expect(listInputs.at(-1)).toMatchObject({ standaloneOnly: true });
    expect(listInputs.at(-1)).not.toHaveProperty("rootsOnly", true);
  });

  it("lists flat under a search, where a match may sit at any depth", async () => {
    items = [{ ...onion, kinds: 1 }];
    await renderScreen();
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
    await renderScreen();

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
    await settle();

    expect(mutations.saveDraft).toHaveBeenCalledWith({
      ingredientId: "red",
      parentId: null,
      add: [],
      remove: [],
      junk: [],
    });
  });

  it("asks for the flagged ones alone when filtered", async () => {
    await renderScreen();

    // The filters live in a panel and land with Apply, as the dashboard's do.
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-filters"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: "flaggedOnly" }));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-filters-apply"));
    });
    await settle();

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
    await renderScreen();

    expect(row("onion")).toHaveTextContent("ui");
    // The panel is named in the viewer's language too.
    await act(async () => {
      fireEvent.click(within(row("onion")).getByTestId("ingredient-toggle"));
    });
    await settle();
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
    await renderScreen();
    const opened = await open("salt");

    await showSpellings(opened);
    // Nothing more to fetch: the chips are the ones the server sent.
    expect(within(opened).getAllByTestId("ingredient-alias")).toHaveLength(1);
  });

  it("says why a food is flagged, on the fold and in the panel, and asks no AI from either", async () => {
    items = [{ ...onion, flagReason: "ai-unsure" }, salt];
    await renderScreen();

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
    await renderScreen();
    const opened = await open("onion");
    const [unsure, ...rest] = within(opened).getAllByTestId("ingredient-ai-change");

    // Only the unsure one: the sure one is Changed by AI's alone.
    expect(rest).toEqual([]);
    expect(unsure).toHaveTextContent("changedByAI.merge");
    await act(async () => {
      fireEvent.click(within(unsure!).getByTestId("ingredient-ai-change-undo"));
    });
    await settle();
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
    await renderScreen();
    const opened = await open("peanut butter");
    const unsure = within(opened).getByTestId("ingredient-ai-change");

    expect(unsure).toHaveTextContent("changedByAI.parentDropped");
    await act(async () => {
      fireEvent.click(within(unsure).getByTestId("ingredient-ai-change-undo"));
    });
    await settle();

    expect(mutations.undoAIChange).toHaveBeenCalledWith({ changeId: "c1" });
  });

  it("offers Changed by AI only while AI changed something, saying how many to check", async () => {
    await renderScreen();

    expect(screen.queryByTestId("ingredients-ai-changes-open")).toBeNull();

    changes = [
      change("c1", "merge", "onion", { from: "uitjes" }),
      { ...change("c2", "parent", "red onion", { target: "onion" }), canAct: false },
    ];
    await reread();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    await settle();
    const [mine, theirs] = within(
      screen.getByRole("dialog", { name: "changedByAI.title" })
    ).getAllByTestId("ingredient-ai-change");

    // A change the viewer may not undo is listed all the same, with nothing to press.
    expect(within(mine!).getByTestId("ingredient-ai-change-undo")).toBeInTheDocument();
    expect(within(theirs!).queryByTestId("ingredient-ai-change-undo")).toBeNull();
  });

  it("keeps or undoes every open change the viewer may act on from Changed by AI's footer", async () => {
    const open = () => [
      { ...change("c1", "merge", "onion", { sure: false }), createdAt: new Date(1) },
      { ...change("c2", "merge", "leek", { sure: false }), createdAt: new Date(2) },
      { ...change("c3", "merge", "garlic", { sure: false }), canAct: false },
      change("c4", "parent", "red onion", { target: "onion" }),
    ];

    changes = open();
    await renderScreen();

    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-ai-changes-keep-all"));
    });
    await settle();
    expect(mutations.settleAIChanges).toHaveBeenCalledWith({
      how: "keep",
      changeIds: ["c1", "c2"],
    });
    // Kept, nothing is left open for the footer to answer.
    expect(screen.queryByTestId("ingredient-ai-changes-keep-all")).toBeNull();

    changes = open();
    await reread();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-ai-changes-undo-all"));
    });
    await settle();
    // Newest first, so no change is undone under a later one.
    expect(mutations.settleAIChanges).toHaveBeenLastCalledWith({
      how: "undo",
      changeIds: ["c2", "c1"],
    });
  });

  it("clears what is settled from Changed by AI, leaving what is still to check", async () => {
    changes = [
      change("c1", "merge", "onion", { sure: false }),
      change("c2", "parent", "red onion", { target: "onion" }),
    ];
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-ai-changes-clear"));
    });
    await settle();

    expect(mutations.clearAIChanges).toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog", { name: "changedByAI.title" }))
        .getAllByTestId("ingredient-ai-change")
        .map((row) => row.dataset.sure)
    ).toEqual(["false"]);
    expect(screen.queryByTestId("ingredient-ai-changes-clear")).toBeNull();
  });

  it("opens a food's own panel from its name in Changed by AI, over it", async () => {
    changes = [change("c1", "merge", "uitjes", { sure: false, from: "onions" })];
    // The list does not list uitjes, so its panel reads the food on its own.
    ownItem = { ...onion, id: "uitjes", name: "uitjes" };
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ai-changes-open"));
    });
    await settle();
    const shown = screen.getByRole("dialog", { name: "changedByAI.title" });

    await act(async () => {
      fireEvent.click(
        within(within(shown).getByTestId("ingredient-ai-change")).getByTestId(
          "ingredient-ai-change-open"
        )
      );
    });
    await settle();

    // The food's panel opens over Changed by AI, with what AI was unsure of at its top.
    const opened = screen.getByRole("dialog", { name: "uitjes" });

    expect(within(opened).getByTestId("ingredient-ai-change")).toHaveTextContent(
      "changedByAI.merge"
    );
    expect(screen.getByRole("dialog", { name: "changedByAI.title" })).toBeInTheDocument();
  });

  it("keeps the panel of a food a filter no longer lists, and closes it once merged away", async () => {
    await renderScreen();
    const opened = await open("onion");

    // Marked distinct under the flagged filter, the row goes; the panel stays.
    items = [salt];
    await reread();
    expect(screen.getByRole("dialog", { name: "onion" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-merge"));
    });
    await settle();
    const asking = screen.getByRole("dialog", { name: "mergeInto" });

    await act(async () => {
      fireEvent.click(within(asking).getByText("pick-salt"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the panel current once a filter no longer lists the food", async () => {
    await renderScreen();
    const opened = await open("onion");

    expect(within(opened).getByTestId("ingredient-flag-notice")).toBeInTheDocument();
    expect(within(opened).getByTestId("ingredient-flagged")).toHaveTextContent("flagged");

    // Given a parent under the flagged filter, the row goes and the flag with it:
    // the panel reads the food on its own and shows it as it now is.
    items = [salt];
    ownItem = { ...onion, flagged: false, parent: { id: "vegetable", name: "vegetable" } };
    await reread();

    const current = screen.getByRole("dialog", { name: "onion" });

    await waitFor(() => expect(within(current).queryByTestId("ingredient-flag-notice")).toBeNull());
    expect(within(current).getByTestId("ingredient-parent")).toHaveTextContent("vegetable");
  });

  it("keeps the typed name and parent once a filter drops the open food and the panel reads it on its own", async () => {
    const vegetable = { id: "vegetable", name: "vegetable" };

    items = [{ ...onion, parent: vegetable }, salt];
    await renderScreen();
    const opened = await open("onion");

    await act(async () => {
      fireEvent.change(within(opened).getByTestId("ingredient-name-input"), {
        target: { value: "Onions" },
      });
      fireEvent.click(within(opened).getByTestId("ingredient-clear-parent"));
    });

    // The same name and parent arrive as the panel's own read, a new object; its flag shows the switch.
    items = [salt];
    ownItem = { ...onion, flagged: false, parent: { ...vegetable } };
    await reread();

    const current = panel("onion");

    await waitFor(() => expect(within(current).queryByTestId("ingredient-flag-notice")).toBeNull());
    expect(within(current).getByTestId("ingredient-name-input")).toHaveValue("Onions");
    expect(within(current).queryByTestId("ingredient-clear-parent")).toBeNull();
  });

  it("closes the panel of a food once it is deleted", async () => {
    await renderScreen();
    const opened = await open("onion");

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-delete"));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredient-delete-confirm"));
    });
    await settle();

    expect(screen.queryByRole("dialog", { name: "onion" })).toBeNull();
  });

  it("credits the catalogue's source and offers it as a download", async () => {
    await renderScreen();

    expect(screen.getByTestId("data-sources")).toHaveTextContent("notice");
    expect(screen.getByTestId("catalogue-export")).toHaveAttribute("href", "/export/ingredients");
  });

  it("says when nothing is flagged", async () => {
    items = [];
    await renderScreen();

    expect(screen.getByTestId("ingredients-empty")).toHaveTextContent("empty");
  });
});
