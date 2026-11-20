// The native surface a planned-item sheet's tests render through, one export per module: `vi.mock`
// each with `async () => (await import(".../__tests__/mocks/plan-sheet")).<name>`.
import type { ReactNode } from "react";
import React from "react";

type Children = { children?: ReactNode };

/** What the date picker was last handed, for a test to pick with. */
export const picks = {
  date: (_date: Date) => {},
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

/** The segmented control: one button per segment. */
export const segmentedMock = {
  Segmented: ({
    segments,
    onChange,
  }: {
    segments: { value: string; testID: string }[];
    onChange: (value: string) => void;
  }) => (
    <>
      {segments.map(({ value, testID }) => (
        <button key={value} data-testid={testID} onClick={() => onChange(value)} />
      ))}
    </>
  ),
};

/** An icon button as a plain button with its testID. */
export const iconButtonMock = {
  IconButton: ({ testID, onPress }: { testID?: string; onPress: () => void }) => (
    <button data-testid={testID} onClick={onPress} />
  ),
};

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
  TextField: pass,
  Skeleton: () => null,
  useThemeColor: () => [],
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

const Sheet = ({
  children,
  name,
  confirm,
  secondary = [],
}: Children & {
  name: string;
  confirm?: { disabled?: boolean; onPress: () => void };
  secondary?: { label: string; onPress: () => void }[];
}) => (
  <div>
    {children}
    {secondary.map((action) => (
      <button
        key={action.label}
        data-testid={`${name}-action-${action.label}`}
        onClick={action.onPress}
      />
    ))}
    {confirm ? (
      <button
        data-testid={`${name}-confirm`}
        disabled={confirm.disabled}
        onClick={confirm.onPress}
      />
    ) : null}
  </div>
);

type ListProps = {
  ListHeaderComponent?: ReactNode;
  data: unknown[];
  getItemLayout?: (data: unknown, index: number) => { length: number; offset: number };
  renderItem: (info: { item: unknown; index: number }) => ReactNode;
};

/** What the list was last handed, for a test to read its layout from. */
export const listProps: { current: ListProps | null } = { current: null };

/** The list renders its header and rows in place. */
const SheetList = (props: ListProps) => {
  listProps.current = props;

  return (
    <div>
      {props.ListHeaderComponent}
      {props.data.map((item, index) => (
        <div key={index}>{props.renderItem({ item, index })}</div>
      ))}
    </div>
  );
};

export const sheet = { Sheet, SheetBody: pass, SheetStrip: pass, SheetList };

export const reactIntl = {
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatDate: () => "d",
    locale: "en",
  }),
};
