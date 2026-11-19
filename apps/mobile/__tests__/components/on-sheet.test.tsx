// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { testID?: string; className?: string; children?: ReactNode };
const host = ({ testID, className, children }: Props) => (
  <div className={className} data-testid={testID}>
    {children}
  </div>
);

vi.mock("react-native", () => ({ View: host, Text: host, Pressable: host }));
vi.mock("@/components/pressable-scale", () => ({ PressableScale: host }));
vi.mock("@/components/card-slice", () => ({ CardSlice: host }));
vi.mock("@/components/ingredient-icon", () => ({ IngredientIcon: host }));
vi.mock("@/features/groceries/components/groceries-states", () => ({ SkeletonCard: host }));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "" }) }));
vi.mock("@/components/server-image", () => ({ ServerImage: host }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock("@norish/shared-react/calendar/todays-meals", () => ({ isRecipeItem: () => false }));
vi.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
vi.mock("@/components/drag-list/drag-list", () => ({
  useDragCard: () => undefined,
  useIsLifted: () => false,
}));
vi.mock("heroui-native", () => ({
  useThemeColor: (names: string[]) => names,
  Skeleton: host,
}));

const { OnSheet } = await import("@/components/on-sheet");
const { CardPhoto } = await import("@/components/card-photo");
const { PlannedThumb } = await import("@/components/planned-thumb");
const { CookbookCover } = await import("@/features/recipes/components/cookbook-cover");
const { RowButton } = await import("@/features/groceries/components/pantry-rows");
const slices =
  await vi.importActual<typeof import("@/components/card-slice")>("@/components/card-slice");

const cases = [
  ["CardPhoto", <CardPhoto key="a" className="x" image={null} />],
  ["PlannedThumb", <PlannedThumb key="c" className="x" item={{} as never} />],
  [
    "CookbookCover",
    <CookbookCover key="d" className="x" cookbook={{ image: null, coverImages: [] } as never} />,
  ],
  ["RowButton", <RowButton key="e" icon="add" label="l" testID="t" onPress={() => {}} />],
] as const;

describe.each(cases)("%s ground", (_, element) => {
  const ground = (onSheet: boolean) => {
    const { container, unmount } = render(<OnSheet value={onSheet}>{element}</OnSheet>);
    const classes = container.innerHTML;

    unmount();

    return classes;
  };

  it("is the translucent fill on a sheet", () => {
    expect(ground(true)).toContain("bg-sand");
    expect(ground(true)).not.toContain("bg-default");
  });

  it("is solid off a sheet", () => {
    expect(ground(false)).toContain("bg-default");
    expect(ground(false)).not.toContain("bg-sand");
  });
});

const edge = { top: false, bottom: false };
const sliceCases = [
  [
    "CardSlice",
    <slices.CardSlice key="a" edge={edge}>
      row
    </slices.CardSlice>,
  ],
  [
    "ItemSlice",
    <slices.ItemSlice key="b" edge={edge}>
      row
    </slices.ItemSlice>,
  ],
] as const;

describe.each(sliceCases)("%s ground", (_, element) => {
  const ground = (onSheet: boolean) =>
    render(<OnSheet value={onSheet}>{element}</OnSheet>).container.innerHTML;

  it("is the translucent fill on a sheet", () => {
    expect(ground(true)).toContain("bg-sand");
    expect(ground(true)).not.toContain("bg-surface");
  });

  it("is the surface off a sheet", () => {
    expect(ground(false)).toContain("bg-surface");
    expect(ground(false)).not.toContain("bg-sand");
  });
});

it("keeps a fill its caller names", () => {
  const named = (
    <slices.CardSlice className="bg-default" edge={edge}>
      row
    </slices.CardSlice>
  );

  expect(render(<OnSheet value>{named}</OnSheet>).container.innerHTML).toContain("bg-default");
});
