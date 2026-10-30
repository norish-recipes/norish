import { StoreHeading } from "@/components/groceries/store-heading";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
    }
  ),
}));

vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const Dropdown = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  Dropdown.Popover = Passthrough;
  Dropdown.Menu = Passthrough;
  Dropdown.Item = ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  );
  Dropdown.Section = Passthrough;

  return {
    Button: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Dropdown,
    Label: Passthrough,
    Separator: () => <hr />,
  };
});

function renderHeading(props: Partial<React.ComponentProps<typeof StoreHeading>> = {}) {
  return render(
    <StoreHeading
      activeCount={2}
      doneCount={0}
      expanded
      name="Costco"
      onExpandedChange={vi.fn()}
      {...props}
    />
  );
}

describe("StoreHeading", () => {
  it("renders no kebab when actions is absent", () => {
    renderHeading();

    // Only the expand toggle button, no Dropdown trigger.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("hides Mark all done and Delete done when their handlers are absent", () => {
    renderHeading({ actions: { onClearAll: vi.fn() } });

    expect(screen.queryByText("markAllDone")).not.toBeInTheDocument();
    expect(screen.queryByText("deleteDone")).not.toBeInTheDocument();
    expect(screen.getByText("clearAll")).toBeInTheDocument();
  });

  it("shows Clear all only when onClearAll is passed", () => {
    renderHeading({ actions: { onMarkAllDone: vi.fn(), onDeleteDone: vi.fn() } });

    expect(screen.getByText("markAllDone")).toBeInTheDocument();
    expect(screen.getByText("deleteDone")).toBeInTheDocument();
    expect(screen.queryByText("clearAll")).not.toBeInTheDocument();
  });

  it("fires onClearAll when Clear all is pressed", () => {
    const onClearAll = vi.fn();

    renderHeading({ actions: { onClearAll } });

    fireEvent.click(screen.getByText("clearAll"));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
