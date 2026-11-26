import type { ReactNode } from "react";
import { createElement } from "react";

type Props = Record<string, unknown> & { children?: ReactNode };

/** The react-native pieces the Content screens draw, as DOM, with `alert` spied on by the test. */
export function reactNative(alert: unknown) {
  const node =
    (tag: string) =>
    ({ children, testID, onPress, accessibilityLabel, disabled }: Props) =>
      createElement(
        tag,
        {
          "data-testid": testID,
          "aria-label": accessibilityLabel,
          disabled: disabled as boolean | undefined,
          onClick: onPress as (() => void) | undefined,
        },
        children
      );
  const FlatList = ({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
    testID,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
    testID?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": testID },
      ListHeaderComponent,
      data.map((item, index) => createElement("div", { key: index }, renderItem({ item, index }))),
      ListFooterComponent
    );

  return {
    Alert: { alert },
    View: node("div"),
    Text: node("span"),
    Pressable: node("button"),
    ScrollView: node("div"),
    FlatList,
  };
}

/** A wrapper that draws only what it wraps. */
export const passThrough = ({ children }: Props) => children;

/** `useText` echoing the id, with its values after it. */
export const echoText = () => (id: string, values?: Record<string, unknown>) =>
  values ? `${id}${JSON.stringify(values)}` : id;

/** The sheet kit as DOM: the title, the confirm and secondary actions as buttons, then the body. */
export function sheet() {
  type SheetProps = {
    name: string;
    title: string;
    back?: boolean;
    confirm?: { label: string; disabled?: boolean; onPress?: () => unknown };
    secondary?: { label: string; disabled?: boolean; onPress: () => unknown }[];
    onClose?: () => void;
    children?: ReactNode;
  };

  const Sheet = ({ name, title, back, confirm, secondary, onClose, children }: SheetProps) =>
    createElement(
      "section",
      { "data-testid": `${name}-sheet`, "data-back": back ? "yes" : undefined },
      createElement("h1", null, title),
      back ? createElement("button", { "data-testid": "sheet-back", onClick: onClose }) : null,
      confirm
        ? createElement(
            "button",
            {
              "data-testid": "sheet-confirm",
              disabled: confirm.disabled,
              onClick: () => void confirm.onPress?.(),
            },
            confirm.label
          )
        : null,
      (secondary ?? []).map((action) =>
        createElement(
          "button",
          {
            key: action.label,
            "data-testid": `sheet-secondary-${action.label}`,
            disabled: action.disabled,
            onClick: () => void action.onPress(),
          },
          action.label
        )
      ),
      children
    );

  return {
    Sheet,
    FitSheet: ({ children, ...props }: SheetProps) =>
      createElement(Sheet, props, createElement("div", null, children)),
    SheetBody: ({ children }: Props) => createElement("div", null, children),
    SheetList: FlatListOf,
  };
}

function FlatListOf({
  data,
  renderItem,
  ListFooterComponent,
  testID,
}: {
  data: unknown[];
  renderItem: (info: { item: unknown; index: number }) => ReactNode;
  ListFooterComponent?: ReactNode;
  testID?: string;
}) {
  return createElement(
    "div",
    { "data-testid": testID },
    data.map((item, index) => createElement("div", { key: index }, renderItem({ item, index }))),
    ListFooterComponent
  );
}

/** The native menu as DOM: the row's own press on the wrapper, each item a button of its own. */
export const nativeMenu = ({
  items,
  testID,
  onPress,
  children,
}: {
  items: { key: string; destructive?: boolean; onPress: () => void }[];
  testID: string;
  onPress?: () => void;
  children?: ReactNode;
}) =>
  createElement(
    "div",
    { "data-testid": testID, onClick: onPress },
    items.map((item) =>
      createElement("button", {
        key: item.key,
        "data-destructive": item.destructive,
        "data-testid": `${testID}-menu-${item.key}`,
        onClick: (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          item.onPress();
        },
      })
    ),
    children
  );

/** The small kit pieces as DOM buttons and inputs. */
export const kit = {
  modalHeader: ({
    title,
    secondary = [],
  }: {
    title: string;
    secondary?: { label: string; disabled?: boolean; onPress: () => void }[];
  }) =>
    createElement(
      "header",
      null,
      title,
      secondary.map((action) =>
        createElement("button", {
          key: action.label,
          "data-testid": "header-add",
          "aria-label": action.label,
          disabled: action.disabled,
          onClick: action.onPress,
        })
      )
    ),
  emptyCard: ({
    testID,
    title,
    action,
  }: {
    testID: string;
    title: string;
    action?: { testID: string; label: string; onPress: () => void };
  }) =>
    createElement(
      "div",
      { "data-testid": testID },
      title,
      action
        ? createElement(
            "button",
            { "data-testid": action.testID, onClick: action.onPress },
            action.label
          )
        : null
    ),
  sheetInput: ({
    testID,
    value,
    editable,
    onChangeText,
    onClear,
    onSubmitEditing,
  }: {
    testID?: string;
    value?: string;
    editable?: boolean;
    onChangeText?: (value: string) => void;
    onClear?: () => void;
    onSubmitEditing?: () => void;
  }) =>
    createElement(
      "span",
      null,
      createElement("input", {
        "data-testid": testID,
        value: value ?? "",
        readOnly: editable === false,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
        onKeyDown: (event: { key: string }) => {
          if (event.key === "Enter") onSubmitEditing?.();
        },
      }),
      onClear
        ? createElement("button", { "data-testid": `${testID}-clear`, onClick: onClear })
        : null
    ),
  button: ({
    testID,
    label,
    onPress,
    onSelectedChange,
    isSelected,
    active,
    disabled,
    accessibilityLabel,
  }: {
    testID?: string;
    label?: string;
    onPress?: () => void;
    onSelectedChange?: (on: boolean) => void;
    isSelected?: boolean;
    active?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
  }) =>
    createElement(
      "button",
      {
        "aria-label": accessibilityLabel,
        "data-testid": testID,
        disabled,
        "aria-pressed": isSelected ?? active,
        onClick: () => (onSelectedChange ? onSelectedChange(!isSelected) : onPress?.()),
      },
      label
    ),
};
