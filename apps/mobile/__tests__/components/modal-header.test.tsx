// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const screen = vi.hoisted(() => ({ options: null as Record<string, unknown> | null }));

type Item = { label: string; identifier: string; variant?: string; disabled?: boolean };
type Options = {
  title: string;
  unstable_headerLeftItems: () => Item[];
  unstable_headerRightItems: () => Item[];
};

vi.mock("expo-router", () => ({
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

    render(<ModalHeader name="demo" title="Rename" onClose={onClose} />);

    expect(declared().title).toBe("Rename");
    expect(declared().unstable_headerLeftItems()).toMatchObject([
      { label: "common.actions.close", identifier: "demo-close", onPress: onClose },
    ]);
    expect(declared().unstable_headerRightItems()).toEqual([]);
  });

  it("adds a prominent confirm item that follows its disabled state", () => {
    const onPress = vi.fn();

    const { rerender } = render(
      <ModalHeader
        confirm={{ label: "Save", disabled: true, onPress }}
        name="demo"
        title="Rename"
        onClose={vi.fn()}
      />
    );

    expect(declared().unstable_headerRightItems()).toMatchObject([
      { label: "Save", identifier: "demo-confirm", variant: "prominent", disabled: true, onPress },
    ]);

    rerender(
      <ModalHeader
        confirm={{ label: "Save", onPress }}
        name="demo"
        title="Rename"
        onClose={vi.fn()}
      />
    );

    expect(declared().unstable_headerRightItems()[0]?.disabled).toBeUndefined();
  });
});
