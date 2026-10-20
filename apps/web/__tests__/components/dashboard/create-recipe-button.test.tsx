import type { ReactNode } from "react";
import CreateRecipeButton from "@/components/dashboard/create-recipe-button";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAIEnabled: true,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: mocks.isAIEnabled }),
}));

vi.mock("@/context/recipes-filters-context", () => ({
  useRecipesFiltersContext: () => ({ filters: { libraryType: "recipes" } }),
}));

vi.mock("@/hooks/cookbooks", () => ({
  useCookbooksMutations: () => ({ createCookbook: vi.fn() }),
}));

vi.mock("@/components/cookbooks/cookbook-icon", () => ({
  CookbookIconSolid: () => <span />,
}));

vi.mock("@/components/cookbooks/cookbook-panels", () => ({
  CookbookTitlePanel: () => null,
}));

vi.mock("@/components/shared/import-recipe-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/shared/import-from-paste-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/shared/import-from-image-modal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="image-modal" role="dialog" /> : null,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@heroui/react", () => {
  type Props = { children?: ReactNode; onPress?: () => void } & Record<string, unknown>;

  const Button = ({ children, onPress }: Props) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  );
  const Label = ({ children }: Props) => <span>{children}</span>;

  const Dropdown = Object.assign(({ children }: Props) => <div>{children}</div>, {
    Popover: ({ children }: Props) => <div>{children}</div>,
    Menu: ({ children }: Props) => <div>{children}</div>,
    Item: ({ children, onPress }: Props) => (
      <div role="menuitem" onClick={onPress}>
        {children}
      </div>
    ),
    SubmenuTrigger: ({ children }: Props) => <div>{children}</div>,
    SubmenuIndicator: () => <span data-testid="submenu-indicator" />,
  });

  return { Button, Dropdown, Label };
});

beforeEach(() => {
  mocks.isAIEnabled = true;
  mocks.push.mockClear();
});

describe("CreateRecipeButton image menu", () => {
  it("puts both image flows under an Images submenu", () => {
    render(<CreateRecipeButton />);

    expect(screen.getByText("recipes.dashboard.images")).toBeInTheDocument();
    expect(screen.getByText("recipes.dashboard.oneRecipeFromPhotos")).toBeInTheDocument();
    expect(screen.getByText("recipes.dashboard.bulkImageImport")).toBeInTheDocument();
    expect(screen.getByTestId("submenu-indicator")).toBeInTheDocument();
    expect(screen.queryByText("recipes.dashboard.importFromImage")).not.toBeInTheDocument();
  });

  it("opens the one-recipe image dialog from the submenu", () => {
    render(<CreateRecipeButton />);

    fireEvent.click(screen.getByText("recipes.dashboard.oneRecipeFromPhotos"));

    expect(screen.getByTestId("image-modal")).toBeInTheDocument();
  });

  it("navigates to the bulk image page from the submenu", () => {
    render(<CreateRecipeButton />);

    fireEvent.click(screen.getByText("recipes.dashboard.bulkImageImport"));

    expect(mocks.push).toHaveBeenCalledWith("/recipes/import");
  });

  it("hides the Images submenu when AI is off", () => {
    mocks.isAIEnabled = false;

    render(<CreateRecipeButton />);

    expect(screen.queryByText("recipes.dashboard.images")).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.dashboard.oneRecipeFromPhotos")).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.dashboard.bulkImageImport")).not.toBeInTheDocument();
  });
});
