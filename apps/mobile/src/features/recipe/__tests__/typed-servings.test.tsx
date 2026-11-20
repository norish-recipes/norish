// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  testID?: string;
  value?: string;
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  onBlur?: () => void;
};

vi.mock("react-native", () => ({
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children, testID, onPress }: Props) => (
    <button data-testid={testID} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  TextInput: ({ testID, value, onChangeText, onBlur }: Props) => (
    <input
      data-testid={testID}
      value={value}
      onBlur={onBlur}
      onChange={(event) => onChangeText?.(event.target.value)}
    />
  ),
}));
vi.mock("@/hooks/use-focus-on-mount", () => ({ useFocusOnMount: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/recipes", () => ({ MIN_SERVINGS: 0.125 }));

const { TypedServings } = await import("../components/typed-servings");

describe("TypedServings", () => {
  it("scales to any typed count of at least the minimum and ignores the rest", () => {
    const onChange = vi.fn();

    render(<TypedServings servings={4} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("recipe-servings-sheet-value"));

    const input = screen.getByTestId("recipe-servings-input") as HTMLInputElement;

    expect(input.value).toBe("4");
    fireEvent.change(input, { target: { value: "2,5" } });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.blur(input);
    expect(screen.getByTestId("recipe-servings-sheet-value")).toBeTruthy();
  });

  it("leaves edit mode when the servings change from outside", () => {
    let setOutside: (servings: number) => void = () => {};
    const Parent = () => {
      const [servings, setServings] = React.useState(4);

      setOutside = setServings;
      return <TypedServings servings={servings} onChange={setServings} />;
    };

    render(<Parent />);
    fireEvent.click(screen.getByTestId("recipe-servings-sheet-value"));
    fireEvent.change(screen.getByTestId("recipe-servings-input"), { target: { value: "6" } });
    expect(screen.getByTestId("recipe-servings-input")).toBeTruthy();
    act(() => setOutside(7));
    expect(screen.queryByTestId("recipe-servings-input")).toBeNull();
  });
});
