import ImportLinkPrompt from "@/app/(app)/import/components/import-link-prompt";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { importRecipeMock, importRecipeWithAIMock, replaceMock, toastMock, permissions } =
  vi.hoisted(() => ({
    importRecipeMock: vi.fn(),
    importRecipeWithAIMock: vi.fn(),
    replaceMock: vi.fn(),
    toastMock: vi.fn(),
    permissions: { isAIEnabled: false },
  }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipesMutations: () => ({
    importRecipe: importRecipeMock,
    importRecipeWithAI: importRecipeWithAIMock,
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => permissions,
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: any) => <div>{children}</div>, {
    Header: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
    Footer: ({ children }: any) => <div>{children}</div>,
  }),
  Button: ({ children, onPress, isDisabled }: any) => (
    <button disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  toast: toastMock,
}));

const LINK = "https://example.com/recipes/soup";

describe("ImportLinkPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.isAIEnabled = false;
  });

  it("shows the link and imports nothing until asked", () => {
    render(<ImportLinkPrompt link={LINK} />);

    expect(screen.getByText(LINK)).toBeTruthy();
    expect(importRecipeMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("imports on press and goes to the recipes", () => {
    render(<ImportLinkPrompt link={LINK} />);

    fireEvent.click(screen.getByRole("button", { name: "import" }));

    expect(importRecipeMock).toHaveBeenCalledExactlyOnceWith(LINK);
    expect(toastMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("does not import twice on a second press", () => {
    render(<ImportLinkPrompt link={LINK} />);

    const button = screen.getByRole("button", { name: "import" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(importRecipeMock).toHaveBeenCalledTimes(1);
  });

  it("offers AI import only when AI is on", () => {
    const { unmount } = render(<ImportLinkPrompt link={LINK} />);

    expect(screen.queryByRole("button", { name: "aiImport" })).toBeNull();
    unmount();

    permissions.isAIEnabled = true;
    render(<ImportLinkPrompt link={LINK} />);
    fireEvent.click(screen.getByRole("button", { name: "aiImport" }));

    expect(importRecipeWithAIMock).toHaveBeenCalledExactlyOnceWith(LINK);
    expect(importRecipeMock).not.toHaveBeenCalled();
  });

  it("cancels without importing", () => {
    render(<ImportLinkPrompt link={LINK} />);

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(importRecipeMock).not.toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("says so when there is no link, with no way to import", () => {
    render(<ImportLinkPrompt link={null} />);

    expect(screen.getByText("noLink")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "import" })).toBeNull();
  });
});
