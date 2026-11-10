import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";

import { onRecipePage } from "./recipe-page";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

// Permissions context: AI disabled -> conversion options should be empty when no data
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(
    () => ({
      hiddenItems: [],
    }),
    {
      reader: () => ({ user: { id: "owner-1" } }),
    }
  )
);

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
  it("does not render when no conversion options available", () => {
    const { wrapper } = onRecipePage({ id: "r1", systemUsed: "metric", recipeIngredients: [] });

    render(<SystemConvertMenu />, { wrapper });

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the recipe's system in the reader's language, not by its stored value", () => {
    const { wrapper } = onRecipePage({
      id: "r1",
      systemUsed: "us",
      recipeIngredients: [{ id: "i1" }],
    });

    render(<SystemConvertMenu />, { wrapper });

    expect(screen.getAllByRole("button")[0]).toHaveTextContent("recipes.measurementSystem.us");
  });
});
