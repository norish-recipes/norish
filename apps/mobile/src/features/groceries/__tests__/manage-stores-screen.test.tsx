// @vitest-environment jsdom
import type { Drop } from "@/components/drag-list/resolve-drop";
import { resolveDrop } from "@/components/drag-list/resolve-drop";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreDto } from "@norish/shared/contracts";

const store = (id: string, sortOrder: number) =>
  ({ id, name: id, sortOrder, color: "primary", aisles: [], version: 1 }) as unknown as StoreDto;
const held = vi.hoisted(() => ({
  stores: [] as StoreDto[],
  isRead: true,
  lines: [] as { storeId: string; isDone?: boolean }[],
  reorder: vi.fn(),
  remove: vi.fn(),
  save: vi.fn(),
  alert: vi.fn(),
  list: {} as { rows: { key: string }[]; onDrop: (drop: Drop<never, never>) => boolean },
  editor: {} as { editing?: { id: string | null; name: string }; onSave: () => Promise<void> },
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Alert: { alert: held.alert },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      createElement("span", { "data-testid": testID }, children),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      createElement("div", { "data-testid": testID }, children),
  };
});
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("heroui-native", async () => {
  const { createElement } = await import("react");
  const Button = ({
    children,
    testID,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    onPress?: () => void;
  }) => createElement("button", { "data-testid": testID, onClick: onPress }, children);

  Button.Label = ({ children }: { children?: React.ReactNode }) => children;

  return { Button, useThemeColor: () => ["#000"] };
});
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/hooks/use-cancel-button", () => ({
  useCancelButton: () => ({ text: "cancel", style: "cancel" }),
}));
vi.mock("@/components/sheet", async () => {
  const { createElement } = await import("react");

  return {
    Sheet: ({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) =>
      createElement("div", null, children, actions),
    SheetBody: ({ children }: { children?: React.ReactNode }) =>
      createElement("div", null, children),
    SHEET_SCROLL_END: {},
  };
});
vi.mock("@/components/drag-list/drag-list", () => ({
  DragList: (props: typeof held.list & { renderItem: (item: never) => React.ReactNode }) => {
    Object.assign(held.list, props);

    return (
      <div>
        {props.rows.map(
          (row) =>
            (row as unknown as { value: never; key: string }) &&
            props.renderItem((row as unknown as { value: never }).value)
        )}
      </div>
    );
  },
}));
vi.mock("../components/groceries-states", () => ({
  SkeletonCard: () => <i data-testid="stores-skeleton" />,
}));
vi.mock("../components/store-list-row", () => ({
  StoreListRow: ({
    store: row,
    onDelete,
    onEdit,
  }: {
    store: StoreDto;
    onDelete: () => void;
    onEdit: () => void;
  }) => (
    <div>
      <button data-testid={`edit-${row.id}`} onClick={onEdit} />
      <button data-testid={`delete-${row.id}`} onClick={onDelete} />
    </div>
  ),
}));
vi.mock("../components/store-editor-sheet", () => ({
  StoreEditorSheet: (props: typeof held.editor) => {
    Object.assign(held.editor, props);

    return <div data-testid="store-editor" />;
  },
}));
vi.mock("@norish/shared-react/groceries", async (importActual) => ({
  ...(await importActual<object>()),
  useGroceriesQuery: () => ({ groceries: held.lines }),
  useSaveStore: () => ({ save: held.save, shopCheck: null }),
  useStoresMutations: () => ({ reorderStores: held.reorder, deleteStore: held.remove }),
  useStoresQuery: () => ({ stores: held.stores, isRead: held.isRead }),
}));

const { ManageStoresScreen } = await import("../screens/manage-stores-screen");

describe("Manage stores", () => {
  beforeEach(() => {
    held.stores = [store("a", 0), store("b", 1), store("c", 2)];
    held.isRead = true;
    held.lines = [];
    for (const fn of [held.reorder, held.remove, held.save, held.alert]) fn.mockReset();
  });

  it("is a skeleton until the Stores have been read, then says there are none", () => {
    held.stores = [];
    held.isRead = false;
    const { rerender } = render(<ManageStoresScreen />);

    expect(screen.getByTestId("stores-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("stores-empty")).toBeNull();

    held.isRead = true;
    rerender(<ManageStoresScreen />);

    expect(screen.getByTestId("stores-empty")).toBeTruthy();
  });

  it("writes a drop against the Stores as they are when the row lands", () => {
    const { rerender } = render(<ManageStoresScreen />);
    const landed = resolveDrop(held.list.rows as never[], 2, 0)!;

    // A housemate adds a Store while the row is carried.
    held.stores = [...held.stores, store("d", 3)];
    rerender(<ManageStoresScreen />);
    act(() => void held.list.onDrop(landed as never));

    expect(held.reorder).toHaveBeenCalledWith(["c", "a", "b", "d"]);
  });

  it("asks what to do with a Store's lines, and does it", () => {
    held.lines = [{ storeId: "a" }, { storeId: "a" }, { storeId: "b" }];
    render(<ManageStoresScreen />);
    fireEvent.click(screen.getByTestId("delete-a"));
    const buttons = held.alert.mock.calls[0]?.[2] as { onPress?: () => void }[];

    expect(buttons).toHaveLength(3);
    buttons[1]?.onPress?.();
    buttons[2]?.onPress?.();

    expect(held.remove).toHaveBeenNthCalledWith(1, "a", false);
    expect(held.remove).toHaveBeenNthCalledWith(2, "a", true);
  });

  it("counts ticked lines too, since deleting the Store reaches them", () => {
    held.lines = [{ storeId: "a", isDone: true }];
    render(<ManageStoresScreen />);
    fireEvent.click(screen.getByTestId("delete-a"));
    const buttons = held.alert.mock.calls[0]?.[2] as { onPress?: () => void }[];

    expect(buttons).toHaveLength(3);
  });

  it("deletes a Store with no lines after one confirmation", () => {
    render(<ManageStoresScreen />);
    fireEvent.click(screen.getByTestId("delete-c"));
    const buttons = held.alert.mock.calls[0]?.[2] as { onPress?: () => void }[];

    expect(buttons).toHaveLength(2);
    buttons[1]?.onPress?.();

    expect(held.remove).toHaveBeenCalledWith("c", false);
  });

  it("opens the editor on a tap, and keeps it open when the save is refused", async () => {
    render(<ManageStoresScreen />);
    fireEvent.click(screen.getByTestId("edit-b"));

    expect(held.editor.editing?.id).toBe("b");

    held.save.mockResolvedValueOnce(false);
    await act(async () => held.editor.onSave());
    expect(screen.getByTestId("store-editor")).toBeTruthy();

    held.save.mockResolvedValueOnce(true);
    await act(async () => held.editor.onSave());
    expect(screen.queryByTestId("store-editor")).toBeNull();
  });
});
