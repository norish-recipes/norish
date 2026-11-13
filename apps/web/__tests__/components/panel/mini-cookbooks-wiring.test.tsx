/** The membership panel's wiring to useCookbookMembership: what it shows, and what Save does. */
import type { ReactNode } from "react";
import MiniCookbooks from "@/components/Panel/consumers/mini-cookbooks";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const membership = vi.hoisted(() => ({
  isDirty: false,
  save: vi.fn(),
  setNewTitle: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

vi.mock("@norish/shared-react/recipes", () => ({
  useCookbookMembership: () => ({
    cookbooks: [],
    isLoading: false,
    isMember: () => false,
    toggle: vi.fn(),
    newTitle: "",
    setNewTitle: membership.setNewTitle,
    pending: [],
    stageNew: vi.fn(),
    unstage: vi.fn(),
    isDirty: membership.isDirty,
    save: membership.save,
  }),
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

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress, isDisabled, ...props }: any) => (
    <button disabled={isDisabled} type="button" onClick={onPress} {...props}>
      {children}
    </button>
  ),
  Input: (props: any) => <input {...props} />,
  Separator: () => <hr />,
}));

const renderPanel = () =>
  render(<MiniCookbooks open recipeIds={["recipe-1"]} onOpenChange={vi.fn()} />);

describe("MiniCookbooks", () => {
  beforeEach(() => {
    membership.isDirty = false;
    membership.save.mockReset();
  });

  it("keeps Save off while nothing is staged", () => {
    renderPanel();

    expect(screen.getByTestId("save-cookbook-membership")).toBeDisabled();
  });

  it("saves through the hook once something is staged", () => {
    membership.isDirty = true;
    renderPanel();

    fireEvent.click(screen.getByTestId("save-cookbook-membership"));

    expect(membership.save).toHaveBeenCalledTimes(1);
  });

  it("types a new cookbook's title into the hook", () => {
    renderPanel();

    fireEvent.change(screen.getByTestId("new-cookbook-title"), { target: { value: "Christmas" } });

    expect(membership.setNewTitle).toHaveBeenCalledWith("Christmas");
  });
});
