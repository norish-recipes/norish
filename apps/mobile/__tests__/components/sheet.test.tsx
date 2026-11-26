// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  testID?: string;
  style?: object | object[];
  contentContainerStyle?: object;
  contentContainerClassName?: string;
  onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
};

const keyboard = vi.hoisted(
  () => new Map<string, (event: { endCoordinates: { screenY: number } }) => void>()
);
const WINDOW = 874;
const TOP = 62;
const BOTTOM = 34;

const host =
  (kind: string) =>
  ({
    children,
    testID,
    style,
    contentContainerStyle,
    contentContainerClassName,
    onLayout,
  }: Props) => (
    <div
      data-class={contentContainerClassName}
      data-content={JSON.stringify(contentContainerStyle ?? {})}
      data-kind={kind}
      data-style={JSON.stringify(Object.assign({}, ...[style ?? {}].flat()))}
      data-testid={testID}
      // A layout a test reports as `height` px.
      onClick={(event) =>
        onLayout?.({ nativeEvent: { layout: { height: Number(event.currentTarget.title) } } })
      }
    >
      {children}
    </div>
  );

vi.mock("react-native", () => ({
  View: host("view"),
  ScrollView: host("scroll"),
  FlatList: host("list"),
  Text: host("text"),
  Platform: { OS: "ios" },
  useWindowDimensions: () => ({ width: 402, height: WINDOW }),
  Keyboard: {
    addListener: (
      name: string,
      listener: (event: { endCoordinates: { screenY: number } }) => void
    ) => {
      keyboard.set(name, listener);

      return { remove: () => keyboard.delete(name) };
    },
  },
}));
vi.mock("react-native-reanimated", () => ({
  default: { View: host("animated") },
  useAnimatedStyle: (style: () => object) => style(),
  withTiming: (value: number) => value,
}));
vi.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: { insets: { top: TOP, bottom: BOTTOM } },
}));
vi.mock("@/lib/tab-bar-visibility", () => ({ useMarkSheetOpen: () => {} }));
vi.mock("@/components/modal-header", () => ({ ModalHeader: () => null }));

const { FitSheet, Sheet, SheetBody, SheetList, SheetScrollView, SHEET_BODY_TOP, FULL_SHEET_TOP } =
  await import("@/components/sheet");
// The native header: where the body starts under the sheet's top.
const HEADER = SHEET_BODY_TOP - FULL_SHEET_TOP;

const styleOf = (testID: string) =>
  JSON.parse(screen.getByTestId(testID).getAttribute("data-style") ?? "{}") as Record<
    string,
    unknown
  >;
const layOut = (testID: string, height: number) => {
  const view = screen.getByTestId(testID);

  view.title = String(height);
  fireEvent.click(view);
};

function fitSheet() {
  render(
    <Sheet name="fit" title="Fit">
      <SheetBody>
        <span data-testid="content">content</span>
      </SheetBody>
    </Sheet>
  );
}

describe("FitSheet", () => {
  it("is a sheet whose body is a fit body", () => {
    render(
      <FitSheet name="fit" title="Fit">
        <span data-testid="content">content</span>
      </FitSheet>
    );

    expect(screen.getByTestId("content").closest("[data-kind]")?.getAttribute("data-kind")).toBe(
      "scroll"
    );
    expect(screen.getByTestId("fit-sheet")).toBeTruthy();
  });
});

describe("Sheet", () => {
  it("lays a fit sheet's blocks 16 pt apart unless the body says otherwise", () => {
    const bodyClass = () =>
      screen.getByTestId("content").closest("[data-class]")?.getAttribute("data-class");

    fitSheet();
    expect(bodyClass()).toContain("gap-4");
    cleanup();
    render(
      <Sheet name="fit" title="Fit">
        <SheetBody contentClassName="gap-2">
          <span data-testid="content">content</span>
        </SheetBody>
      </Sheet>
    );
    expect(bodyClass()).toContain("gap-2");
    expect(bodyClass()).not.toContain("gap-4");
  });

  it("holds a fit sheet's content to the room under the sheet's top, its body scrolling beyond", () => {
    fitSheet();

    expect(styleOf("fit-sheet").maxHeight).toBe(WINDOW - SHEET_BODY_TOP);
    expect(screen.getByTestId("content").closest("[data-kind]")?.getAttribute("data-kind")).toBe(
      "scroll"
    );
    // A first-child scroll view would be stretched to the whole sheet by react-native-screens.
    expect(screen.getByTestId("fit-sheet").firstElementChild?.getAttribute("data-kind")).toBe(
      "view"
    );
  });

  it("holds the sheet above the keyboard by the keyboard alone, however tall it lays out", () => {
    fitSheet();
    act(() => keyboard.get("keyboardWillChangeFrame")?.({ endCoordinates: { screenY: 500 } }));

    layOut("fit-sheet", 600);
    const first = styleOf("fit-sheet");

    layOut("fit-sheet", 900);
    expect(styleOf("fit-sheet")).toEqual(first);
    expect(first.maxHeight).toBe(500 - SHEET_BODY_TOP);
  });

  it("pads a first-child body past the header react-native-screens stretches it under", () => {
    const contentOf = (testID: string) =>
      JSON.parse(screen.getByTestId(testID).getAttribute("data-content") ?? "{}") as Record<
        string,
        unknown
      >;

    render(
      <Sheet name="scroll" title="Scroll">
        <SheetScrollView testID="scroll-body" />
        <SheetList data={[]} renderItem={() => null} testID="list-body" />
        <SheetList nested data={[]} renderItem={() => null} testID="nested-body" />
      </Sheet>
    );

    // Stretched to the sheet's height from below the header, it ends a header below the sheet.
    expect(contentOf("scroll-body").paddingBottom).toBe(16 + BOTTOM + HEADER);
    expect(contentOf("list-body").paddingBottom).toBe(16 + BOTTOM + HEADER);
    // Under other content it keeps its laid-out height, which ends at the sheet's bottom.
    expect(contentOf("nested-body").paddingBottom).toBe(16 + BOTTOM);
  });
});
