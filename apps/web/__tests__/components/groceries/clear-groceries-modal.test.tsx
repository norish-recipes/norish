import { ClearGroceriesModal } from "@/components/groceries/clear-groceries-modal";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
}));

vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    Button: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Modal: {
      Backdrop: ({ children, isOpen }: { children?: React.ReactNode; isOpen: boolean }) =>
        isOpen ? <div>{children}</div> : null,
      Container: Passthrough,
      Dialog: Passthrough,
      Header: Passthrough,
      Body: Passthrough,
      Footer: Passthrough,
    },
  };
});

describe("ClearGroceriesModal", () => {
  it("shows the whole-list copy when scopeName is null", () => {
    render(
      <ClearGroceriesModal
        isOpen
        itemCount={5}
        scopeName={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("listTitle")).toBeInTheDocument();
    expect(screen.getByText("listDescription 5")).toBeInTheDocument();
  });

  it("shows the named-scope copy when scopeName is set", () => {
    render(
      <ClearGroceriesModal
        isOpen
        itemCount={3}
        scopeName="Costco"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("sectionTitle")).toBeInTheDocument();
    expect(screen.getByText("sectionDescription Costco 3")).toBeInTheDocument();
  });

  it("fires onConfirm and onClose when confirmed", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ClearGroceriesModal
        isOpen
        itemCount={1}
        scopeName={null}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText("confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires only onClose when cancelled", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ClearGroceriesModal
        isOpen
        itemCount={1}
        scopeName={null}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText("cancel"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    render(
      <ClearGroceriesModal
        isOpen={false}
        itemCount={1}
        scopeName={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByText("listTitle")).not.toBeInTheDocument();
  });
});
