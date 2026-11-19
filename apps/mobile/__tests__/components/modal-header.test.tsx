// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const screen = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  back: vi.fn(),
}));

type Item = {
  type?: string;
  label: string;
  icon?: { name: string };
  variant?: string;
  disabled?: boolean;
  tintColor?: string;
  menu?: { items: { label: string; destructive?: boolean }[] };
};
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
vi.mock("heroui-native", () => ({ useThemeColor: () => ["red"] }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { ModalHeader, destructiveAction } = await import("@/components/modal-header");

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
      { label: "Save", variant: "prominent", disabled: true },
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

  it("fires the latest handler from an item the native header has not yet replaced", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <ModalHeader confirm={{ label: "Create", onPress: stale }} title="New" onClose={vi.fn()} />
    );
    const nativeItem = declared().unstable_headerRightItems()[0] as unknown as {
      onPress: () => void;
    };

    rerender(
      <ModalHeader confirm={{ label: "Create", onPress: latest }} title="New" onClose={vi.fn()} />
    );
    nativeItem.onPress();

    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it("puts one secondary action before the confirm as a glass item, red when destructive", () => {
    const remove = vi.fn();

    render(
      <ModalHeader
        confirm={{ label: "Save", onPress: vi.fn() }}
        secondary={[{ label: "Delete", symbol: "trash", destructive: true, onPress: remove }]}
        title="Edit"
      />
    );
    const items = declared().unstable_headerRightItems();

    expect(items).toMatchObject([
      { type: "button", label: "Delete", icon: { name: "trash" }, tintColor: "red" },
      { label: "Save", variant: "prominent" },
    ]);
    (items[0] as unknown as { onPress: () => void }).onPress();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("gathers several secondary actions into one menu, destructive ones marked", () => {
    render(
      <ModalHeader
        secondary={[
          { label: "Go to recipe", symbol: "book", onPress: vi.fn() },
          { label: "Remove", symbol: "trash", destructive: true, onPress: vi.fn() },
        ]}
        title="Item"
      />
    );

    expect(declared().unstable_headerRightItems()).toMatchObject([
      {
        type: "menu",
        label: "recipes.actions.actionsLabel",
        menu: { items: [{ label: "Go to recipe" }, { label: "Remove", destructive: true }] },
      },
    ]);
  });

  it("runs a confirm's async action once for two presses in the same tick", async () => {
    let finish = () => {};
    const create = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));

    render(<ModalHeader confirm={{ label: "Create", onPress: create }} title="Share" />);
    const press = (declared().unstable_headerRightItems()[0] as unknown as { onPress: () => void })
      .onPress;

    press();
    press();
    expect(create).toHaveBeenCalledOnce();

    finish();
    await Promise.resolve();
    await Promise.resolve();
    press();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("frees the item after a rejected action without raising an unhandled rejection", async () => {
    const failure = Promise.reject(new Error("nope"));
    const handled = vi.spyOn(failure, "then");
    const failing = vi.fn(() => failure);

    render(<ModalHeader confirm={{ label: "Create", onPress: failing }} title="Share" />);
    const press = (declared().unstable_headerRightItems()[0] as unknown as { onPress: () => void })
      .onPress;

    press();
    press();
    expect(failing).toHaveBeenCalledOnce();

    // The header's own handling of the rejection: it rejects in turn if the header left it unhandled.
    await handled.mock.results[0]!.value;
    press();

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("ignores a press on a confirm or action that is disabled", () => {
    const save = vi.fn();
    const act = vi.fn();

    render(
      <ModalHeader
        confirm={{ label: "Save", disabled: true, onPress: save }}
        secondary={[{ label: "More", symbol: "book", disabled: true, onPress: act }]}
        title="Edit"
      />
    );
    const [more, confirm] = declared().unstable_headerRightItems() as unknown as {
      onPress: () => void;
    }[];

    confirm?.onPress();
    more?.onPress();
    expect(save).not.toHaveBeenCalled();
    expect(act).not.toHaveBeenCalled();
  });

  it("shows a lone destructive action as the red bin, not a one-entry menu", () => {
    render(<ModalHeader secondary={[destructiveAction("Delete", vi.fn())]} title="Edit grocery" />);

    expect(declared().unstable_headerRightItems()).toMatchObject([
      { type: "button", label: "Delete", icon: { name: "trash" }, tintColor: expect.anything() },
    ]);
  });

  it("shows a confirm's symbol instead of its label, which stays its accessibility name", () => {
    render(
      <ModalHeader
        confirm={{ label: "Import with AI", symbol: "checkmark", onPress: vi.fn() }}
        title="Photos"
      />
    );

    expect(declared().unstable_headerRightItems()).toMatchObject([
      {
        label: "Import with AI",
        accessibilityLabel: "Import with AI",
        icon: { name: "checkmark" },
        variant: "prominent",
      },
    ]);
  });
});
