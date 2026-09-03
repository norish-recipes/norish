/**
 * The membership panel commits on Save, like every other panel in the app.
 *
 * These are the two things a reader can observe about that: a toggle they
 * tapped is not written until they save, and a cookbook they asked for shows
 * up in the list they asked for it in rather than only on the server.
 */
import type { ReactNode } from "react";
import MiniCookbooks from "@/components/Panel/consumers/mini-cookbooks";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setMembership = vi.fn();
const createCookbook = vi.fn(() => Promise.resolve("new-id"));

const EDITABLE = [
  {
    id: "cookbook-1",
    userId: "reader",
    title: "Weeknights",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    memberCount: 2,
    coverImages: [],
    memberTitles: [],
    memberTags: [],
    totalMinutes: null,
    minServings: null,
    containsRecipe: false,
  },
];

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/cookbooks", () => ({
  useEditableCookbooksQuery: () => ({ cookbooks: EDITABLE, isLoading: false }),
  useCookbooksMutations: () => ({ setMembership, createCookbook }),
}));

vi.mock("@/components/cookbooks/cookbook-cover", () => ({ default: () => null }));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel };
});

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, ...props }: any) => (
    <button disabled={isDisabled} type="button" onClick={onPress} {...props}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@heroui/react", () => {
  // The row's tick is the app's round select box, so the row test needs it —
  // a plain input carrying the same data-slot the containment guard looks for.
  const Checkbox = Object.assign(
    ({ "aria-label": label, isSelected, onChange }: any) => (
      <input
        aria-label={label}
        checked={isSelected}
        data-slot="checkbox"
        type="checkbox"
        onChange={(event) => onChange?.(event.target.checked)}
      />
    ),
    {
      Content: ({ children }: any) => <>{children}</>,
      Control: ({ children }: any) => <>{children}</>,
      Indicator: () => null,
    }
  );

  return {
    Checkbox,
    Button: ({ children, onPress, isDisabled, ...props }: any) => (
      <button disabled={isDisabled} type="button" onClick={onPress} {...props}>
        {children}
      </button>
    ),
    Input: (props: any) => <input {...props} />,
    Separator: () => <hr />,
  };
});

function renderPanel() {
  return render(<MiniCookbooks open recipeId="recipe-1" onOpenChange={vi.fn()} />);
}

describe("MiniCookbooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes nothing until Save", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Weeknights/ }));

    expect(setMembership).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("save-cookbook-membership"));

    expect(setMembership).toHaveBeenCalledWith(
      expect.objectContaining({ cookbookId: "cookbook-1", recipeId: "recipe-1", isMember: true })
    );
  });

  it("forgets a toggle that was tapped back to where it started", () => {
    renderPanel();

    const toggle = screen.getByRole("button", { name: /Weeknights/ });

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getByTestId("save-cookbook-membership")).toBeDisabled();
  });

  it("creates nothing from a title that was never added", () => {
    renderPanel();

    fireEvent.change(screen.getByTestId("new-cookbook-title"), {
      target: { value: "Christmas" },
    });

    // Adding the row is the confirmation step, so Save has nothing to do.
    expect(screen.getByTestId("save-cookbook-membership")).toBeDisabled();
  });

  it("shows a cookbook asked for in the list, and creates it on Save", () => {
    renderPanel();

    fireEvent.change(screen.getByTestId("new-cookbook-title"), {
      target: { value: "Christmas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "newWithRecipe" }));

    // Visible straight away, as a row waiting to be made.
    expect(screen.getByText("Christmas")).toBeInTheDocument();
    expect(createCookbook).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("save-cookbook-membership"));

    expect(createCookbook).toHaveBeenCalledWith({ title: "Christmas", recipeId: "recipe-1" });
  });
});
