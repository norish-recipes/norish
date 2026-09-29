/**
 * The Ingredients page: every food folded to a line, the flagged ones
 * marked, and a panel per food holding its spellings and only the actions
 * the server says the viewer may take.
 */
import IngredientsSettingsContent from "@/app/(app)/settings/ingredients/components/ingredients-settings-content";
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
  rename: vi.fn(async () => ({ success: true })),
  markDistinct: vi.fn(async () => ({ success: true })),
  addAlias: vi.fn(async () => ({ success: true })),
  removeAlias: vi.fn(async () => ({ success: true })),
  merge: vi.fn(async () => ({ success: true })),
  moveAlias: vi.fn(async () => ({ success: true })),
  setParent: vi.fn(async () => ({ success: true })),
  remove: vi.fn(async () => ({ success: true })),
  reviewWithAI: vi.fn(async () => ({
    outcome: "distinct",
    considered: ["salt"],
    englishName: null,
  })),
};
const invalidateQueries = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      list: {
        infiniteQueryOptions: (input: unknown) => {
          listInputs.push(input);

          return { queryKey: ["ingredients.list", input] };
        },
        pathKey: () => ["ingredients.list"],
      },
      spellings: {
        queryOptions: (input: unknown) => ({ queryKey: ["ingredients.spellings", input] }),
      },
      rename: { mutationOptions: () => ({ name: "rename" }) },
      markDistinct: { mutationOptions: () => ({ name: "markDistinct" }) },
      addAlias: { mutationOptions: () => ({ name: "addAlias" }) },
      removeAlias: { mutationOptions: () => ({ name: "removeAlias" }) },
      merge: { mutationOptions: () => ({ name: "merge" }) },
      moveAlias: { mutationOptions: () => ({ name: "moveAlias" }) },
      setParent: { mutationOptions: () => ({ name: "setParent" }) },
      remove: { mutationOptions: () => ({ name: "remove" }) },
      reviewWithAI: { mutationOptions: () => ({ name: "reviewWithAI" }) },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: ({ enabled }: { enabled: boolean }) => ({
    data: enabled ? everySpelling : undefined,
    isFetching: false,
  }),
  useInfiniteQuery: () => ({
    data: { pages: [{ items, nextCursor: null }] },
    isLoading: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  useMutation: ({ name }: { name: keyof typeof mutations }) => ({
    mutateAsync: mutations[name],
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries }),
}));

let viewerLocale = "en";

vi.mock("usehooks-ts", () => ({ useDebounceValue: (value: unknown) => [value] }));

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => viewerLocale,
}));

vi.mock("@/lib/ui/safe-error-toast", () => ({ showSafeErrorToast: vi.fn() }));

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, "data-testid": testId }: any) => (
    <button data-testid={testId} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children }: any) => <div>{children}</div>,
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
  const Panel = ({ children, open, title }: any) =>
    open ? (
      <div aria-label={title} role="dialog">
        {children}
      </div>
    ) : null;

  Panel.Body = ({ children }: any) => <div>{children}</div>;
  Panel.Footer = ({ children }: any) => <div>{children}</div>;

  return { default: Panel, usePanelPortalContainer: () => undefined };
});

// The picker searches the catalogue; here it offers salt, and a new Ingredient where allowed.
vi.mock("@/app/(app)/settings/ingredients/components/ingredient-picker", () => ({
  IngredientPicker: ({ onPick, allowNew, editableOnly, excludeId }: any) => (
    <div data-editable-only={editableOnly} data-exclude={excludeId} data-testid="picker">
      <button type="button" onClick={() => onPick({ id: "salt", name: "salt" })}>
        pick-salt
      </button>
      {allowNew ? (
        <button type="button" onClick={() => onPick({ id: null })}>
          pick-new
        </button>
      ) : null}
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

/** A row folded to a line opens its panel on a press; the edits live there. */
async function open(name: string) {
  await act(async () => {
    fireEvent.click(within(row(name)).getByTestId("ingredient-toggle"));
  });

  return panel(name);
}

describe("IngredientsSettingsContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewerLocale = "en";
    listInputs.length = 0;
    items = [onion, salt];
    everySpelling = [];
  });

  it("lists each food on a line, marks the flagged ones, and opens one to its spellings", async () => {
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-flagged")).toBeInTheDocument();
    expect(within(row("salt")).queryByTestId("ingredient-flagged")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    const opened = await open("onion");

    expect(
      within(opened)
        .getAllByTestId("ingredient-alias")
        .map((chip) => chip.textContent)
    ).toEqual(["onion", "ui"]);
  });

  it("offers only what the viewer may do", async () => {
    render(<IngredientsSettingsContent />);
    const mine = await open("onion");

    expect(within(mine).getByTestId("ingredient-mark-distinct")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-name-input")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-delete")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-merge")).toBeInTheDocument();
    expect(within(mine).getByTestId("ingredient-set-parent")).toBeInTheDocument();
    expect(within(mine).getAllByRole("button", { name: "removeAlias" })).toHaveLength(1);
    expect(within(mine).getAllByTestId("ingredient-alias-move")).toHaveLength(1);

    const theirs = await open("salt");

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

  it("renames a food from its name field, once the name differs", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");
    const field = within(opened).getByTestId("ingredient-name-input");

    expect(within(opened).getByTestId("ingredient-rename")).toBeDisabled();

    await act(async () => {
      fireEvent.change(field, { target: { value: "Onion" } });
    });

    expect(within(opened).getByTestId("ingredient-rename")).toBeEnabled();

    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(mutations.rename).toHaveBeenCalledWith({ ingredientId: "onion", name: "Onion" });
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
  });

  it("adds a household's own spelling", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("salt");
    const field = within(opened).getByTestId("ingredient-alias-input");

    await act(async () => {
      fireEvent.change(field, { target: { value: " zout " } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(mutations.addAlias).toHaveBeenCalledWith({ ingredientId: "salt", text: "zout" });
    expect(field).toHaveValue("");
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
    expect(within(picker).queryByText("pick-new")).toBeNull();
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

    await act(async () => {
      fireEvent.click(within(opened).getByTestId("ingredient-alias-move"));
    });
    const asking = screen.getByRole("dialog", { name: "moveTo" });

    await act(async () => {
      fireEvent.click(within(asking).getByText("pick-new"));
    });
    await act(async () => {
      fireEvent.click(within(asking).getByTestId("ingredient-relocation-confirm"));
    });

    expect(mutations.moveAlias).toHaveBeenCalledWith({ aliasId: "a-onion", targetId: null });
  });

  it("sets the food a food is a kind of, from any Ingredient", async () => {
    render(<IngredientsSettingsContent />);
    const opened = await open("onion");

    expect(within(opened).getByText("noParent")).toBeInTheDocument();
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

    expect(mutations.setParent).toHaveBeenCalledWith({ ingredientId: "onion", parentId: "salt" });
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

    expect(within(theirs).getByTestId("ingredient-parent")).toHaveTextContent("kindOf");
    expect(within(theirs).queryByTestId("ingredient-clear-parent")).toBeNull();

    const mine = await open("red onion");

    fireEvent.click(within(mine).getByTestId("ingredient-clear-parent"));

    expect(mutations.setParent).toHaveBeenCalledWith({ ingredientId: "red", parentId: null });
  });

  it("asks for the flagged ones alone when filtered", async () => {
    render(<IngredientsSettingsContent />);

    await act(async () => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(listInputs.at(-1)).toEqual({ search: undefined, flaggedOnly: true, locale: "en" });
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
    const chips = () =>
      within(opened)
        .getAllByTestId("ingredient-alias")
        .map((chip) => chip.textContent);

    expect(within(opened).getByText("shownAs")).toBeInTheDocument();
    expect(chips()).toEqual(["ui", "ajuin"]);
    fireEvent.click(within(opened).getByTestId("ingredient-all-spellings"));
    expect(chips()).toEqual(["onion", "ui", "Zwiebel", "ajuin"]);
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

    expect(within(opened).getAllByTestId("ingredient-alias")).toHaveLength(1);
    expect(within(opened).queryByTestId("ingredient-all-spellings")).toBeNull();
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

  it("offers to ask AI about every flagged food on screen", async () => {
    render(<IngredientsSettingsContent />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("ingredients-ask-ai-all"));
    });

    // Only onion is flagged and editable.
    expect(mutations.reviewWithAI).toHaveBeenCalledTimes(1);
    expect(mutations.reviewWithAI).toHaveBeenCalledWith({ ingredientId: "onion" });
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
