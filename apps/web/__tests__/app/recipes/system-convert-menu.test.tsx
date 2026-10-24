import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const recipeState = vi.hoisted(() => ({
  recipe: { id: "r1", systemUsed: "metric", recipeIngredients: [] as unknown[] },
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    recipe: recipeState.recipe as any,
    convertingTo: null,
    startConversion: () => {},
  }),
}));

// Permissions context: AI disabled -> conversion options should be empty when no data
vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { id: "owner-1" } }),
}));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(() => ({
    hiddenItems: [],
  }))
);

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: false }),
}));

vi.mock("@heroui/react", () => ({
  Dropdown: Object.assign(({ children }: any) => <div>{children}</div>, {
    Trigger: ({ children }: any) => <div>{children}</div>,
    Popover: ({ children }: any) => <div>{children}</div>,
    Menu: ({ children }: any) => <div>{children}</div>,
    Item: ({ children }: any) => <div>{children}</div>,
  }),
  Button: ({ children }: any) => <button>{children}</button>,
  Spinner: () => <span />,
}));

vi.mock("@heroicons/react/20/solid", () => ({
  ArrowsRightLeftIcon: () => <span />,
  SparklesIcon: () => <span />,
}));

describe("SystemConvertMenu", () => {
  beforeEach(() => {
    recipeState.recipe = { id: "r1", systemUsed: "metric", recipeIngredients: [] };
  });

  it("does not render when no conversion options available", () => {
    render(<SystemConvertMenu />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the recipe's system in the reader's language, not by its stored value", () => {
    recipeState.recipe = { id: "r1", systemUsed: "us", recipeIngredients: [{ id: "i1" }] };

    render(<SystemConvertMenu />);

    expect(screen.getAllByRole("button")[0]).toHaveTextContent("recipes.measurementSystem.us");
  });
});
