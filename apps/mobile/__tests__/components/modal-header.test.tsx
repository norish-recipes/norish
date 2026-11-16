// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const screen = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  back: vi.fn(),
}));

type Item = { label: string; icon?: { name: string }; variant?: string; disabled?: boolean };
type Options = {
  title: string;
  unstable_headerLeftItems: () => Item[];
  unstable_headerRightItems: () => Item[];
};

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: screen.back }),
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => {
      screen.options = options;

      return null;
    },
  },
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { ModalHeader } = await import("@/components/modal-header");

const declared = () => screen.options as unknown as Options;

describe("ModalHeader", () => {
  it("declares the system title and a Close on the left, with no confirm item", () => {
    const onClose = vi.fn();

    render(<ModalHeader title="Rename" onClose={onClose} />);

    expect(declared().title).toBe("Rename");
    expect(declared().unstable_headerLeftItems()).toMatchObject([
      { label: "common.actions.close", onPress: onClose },
    ]);
    expect(declared().unstable_headerRightItems()).toEqual([]);
  });

  it("goes back by default", () => {
    render(<ModalHeader title="Rename" />);

    (declared().unstable_headerLeftItems()[0] as unknown as { onPress: () => void }).onPress();
    expect(screen.back).toHaveBeenCalledOnce();
  });

  it("shows a Back chevron instead of Close for a step", () => {
    render(<ModalHeader back title="Store" onClose={vi.fn()} />);

    expect(declared().unstable_headerLeftItems()).toMatchObject([
      { label: "common.actions.back", icon: { name: "chevron.backward" } },
    ]);
  });

  it("disables the confirm item that has no handler", () => {
    render(<ModalHeader confirm={{ label: "Add" }} title="Add" onClose={vi.fn()} />);

    expect(declared().unstable_headerRightItems()[0]?.disabled).toBe(true);
  });

  it("adds a prominent confirm item that follows its disabled state", () => {
    const onPress = vi.fn();

    const { rerender } = render(
      <ModalHeader
        confirm={{ label: "Save", disabled: true, onPress }}

        title="Rename"
        onClose={vi.fn()}
      />
    );

    expect(declared().unstable_headerRightItems()).toMatchObject([
      { label: "Save", variant: "prominent", disabled: true, onPress },
    ]);

    rerender(
      <ModalHeader
        confirm={{ label: "Save", onPress }}

        title="Rename"
        onClose={vi.fn()}
      />
    );

    expect(declared().unstable_headerRightItems()[0]?.disabled).toBe(false);
  });
});
