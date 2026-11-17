// The native surface a planned-item sheet's tests render through, one export per module: `vi.mock`
// each with `async () => (await import(".../__tests__/mocks/plan-sheet")).<name>`.
import type { ReactNode } from "react";
import React from "react";

type Children = { children?: ReactNode };

/** What the date picker and the slot tabs were last handed, for a test to pick with. */
export const picks = {
  date: (_date: Date) => {},
  slot: (_slot: string) => {},
};

const pass = ({ children }: Children) => children;

const Button = Object.assign(
  ({
    children,
    testID,
    isDisabled,
    onPress,
  }: Children & { testID?: string; isDisabled?: boolean; onPress?: () => void }) => (
    <button data-testid={testID} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
  { Label: pass }
);

const Tabs = Object.assign(
  ({ children, onValueChange }: Children & { onValueChange: (slot: string) => void }) => {
    picks.slot = onValueChange;

    return children;
  },
  {
    List: pass,
    Indicator: () => null,
    Trigger: ({ testID, value }: { testID?: string; value: string }) => (
      <button data-testid={testID} onClick={() => picks.slot(value)} />
    ),
    Label: pass,
  }
);

export const reactNative = {
  Text: ({ children }: Children) => <span>{children}</span>,
  View: ({ children }: Children) => <div>{children}</div>,
  Pressable: ({
    children,
    testID,
    onPress,
  }: Children & { testID?: string; onPress?: () => void }) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
};

export const heroui = {
  Button,
  Tabs,
  TextField: pass,
  Skeleton: () => null,
  Input: ({
    testID,
    value,
    onChangeText,
    onSubmitEditing,
  }: {
    testID?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
  }) => (
    <input
      data-testid={testID}
      value={value}
      onChange={(event) => onChangeText?.(event.target.value)}
      onKeyDown={(event) => event.key === "Enter" && onSubmitEditing?.()}
    />
  ),
};

export const swiftUi = {
  Host: pass,
  DatePicker: ({ onDateChange }: { onDateChange: (date: Date) => void }) => {
    picks.date = onDateChange;

    return null;
  },
};

export const swiftUiModifiers = { accessibilityIdentifier: () => null, tint: () => null };

const Sheet = Object.assign(
  ({
    children,
    actions,
    name,
    confirm,
  }: Children & {
    actions?: ReactNode;
    name: string;
    confirm?: { disabled?: boolean; onPress: () => void };
  }) => (
    <div>
      {children}
      {actions}
      {confirm ? (
        <button
          data-testid={`${name}-confirm`}
          disabled={confirm.disabled}
          onClick={confirm.onPress}
        />
      ) : null}
    </div>
  ),
  { Actions: pass, Action: pass }
);

export const sheet = { Sheet, SheetBody: pass, SheetStrip: pass };

export const reactIntl = {
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatDate: () => "d",
    locale: "en",
  }),
};
