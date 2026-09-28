/**
 * The Ingredients page: every food with its spellings, the flagged ones
 * marked, and only the actions the server says the viewer may take.
 */
import IngredientsSettingsContent from "@/app/(app)/settings/ingredients/components/ingredients-settings-content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

type Item = {
  id: string;
  name: string;
  flagged: boolean;
  version: number;
  canEdit: boolean;
  aliases: Array<{ id: string; text: string; canRemove: boolean }>;
};

let items: Item[] = [];
const listInputs: unknown[] = [];
const mutations = {
  rename: vi.fn(async () => ({ success: true })),
  markDistinct: vi.fn(async () => ({ success: true })),
  addAlias: vi.fn(async () => ({ success: true })),
  removeAlias: vi.fn(async () => ({ success: true })),
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
      rename: { mutationOptions: () => ({ name: "rename" }) },
      markDistinct: { mutationOptions: () => ({ name: "markDistinct" }) },
      addAlias: { mutationOptions: () => ({ name: "addAlias" }) },
      removeAlias: { mutationOptions: () => ({ name: "removeAlias" }) },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({
    data: { pages: [{ items, nextCursor: null }] },
    isLoading: false,
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

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/ui/safe-error-toast", () => ({ showSafeErrorToast: vi.fn() }));

vi.mock("@/components/shared/action-button", () => ({
  IconActionButton: ({ label, onPress, action, isDisabled }: any) => (
    <button
      aria-label={label}
      data-testid={`icon-${action}`}
      disabled={isDisabled}
      type="button"
      onClick={onPress}
    />
  ),
}));

const onion: Item = {
  id: "onion",
  name: "onion",
  flagged: true,
  version: 1,
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
  version: 1,
  canEdit: false,
  aliases: [{ id: "a-salt", text: "salt", canRemove: false }],
};

function row(name: string) {
  return screen
    .getAllByTestId("ingredient-row")
    .find((element) => element.getAttribute("data-ingredient") === name)!;
}

describe("IngredientsSettingsContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInputs.length = 0;
    items = [onion, salt];
  });

  it("lists each food with its spellings, and marks the flagged ones", () => {
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-flagged")).toBeInTheDocument();
    expect(within(row("salt")).queryByTestId("ingredient-flagged")).toBeNull();
    expect(
      within(row("onion"))
        .getAllByTestId("ingredient-alias")
        .map((chip) => chip.textContent)
    ).toEqual(["onion", "ui"]);
  });

  it("offers only what the viewer may do", () => {
    render(<IngredientsSettingsContent />);

    expect(within(row("onion")).getByTestId("ingredient-mark-distinct")).toBeInTheDocument();
    expect(within(row("onion")).getByTestId("icon-edit")).toBeInTheDocument();
    expect(within(row("onion")).getAllByRole("button", { name: "removeAlias" })).toHaveLength(1);
    expect(within(row("salt")).queryByTestId("icon-edit")).toBeNull();
    expect(within(row("salt")).queryByRole("button", { name: "removeAlias" })).toBeNull();
    // Adding a spelling is open to everyone.
    expect(within(row("salt")).getByTestId("ingredient-alias-input")).toBeInTheDocument();
  });

  it("marks a flagged food distinct", async () => {
    render(<IngredientsSettingsContent />);

    await act(async () => {
      fireEvent.click(within(row("onion")).getByTestId("ingredient-mark-distinct"));
    });

    expect(mutations.markDistinct).toHaveBeenCalledWith({ ingredientId: "onion" });
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it("renames a food", async () => {
    render(<IngredientsSettingsContent />);

    await act(async () => {
      fireEvent.click(within(row("onion")).getByTestId("icon-edit"));
    });
    const field = within(row("onion")).getByTestId("ingredient-name-input");

    await act(async () => {
      fireEvent.change(field, { target: { value: "Onion" } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(mutations.rename).toHaveBeenCalledWith({ ingredientId: "onion", name: "Onion" });
  });

  it("adds a household's own spelling", async () => {
    render(<IngredientsSettingsContent />);
    const field = within(row("salt")).getByTestId("ingredient-alias-input");

    await act(async () => {
      fireEvent.change(field, { target: { value: " zout " } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(mutations.addAlias).toHaveBeenCalledWith({ ingredientId: "salt", text: "zout" });
    expect(field).toHaveValue("");
  });

  it("asks for the flagged ones alone when filtered", async () => {
    render(<IngredientsSettingsContent />);

    await act(async () => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(listInputs.at(-1)).toEqual({ search: undefined, flaggedOnly: true });
  });

  it("says when nothing is flagged", () => {
    items = [];
    render(<IngredientsSettingsContent />);

    expect(screen.getByTestId("ingredients-empty")).toHaveTextContent("empty");
  });
});
