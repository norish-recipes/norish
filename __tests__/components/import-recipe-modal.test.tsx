import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ImportRecipeModal from "@/components/shared/import-recipe-modal";

const modalMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/context/recipes-context", () => ({
  useRecipesContext: () => ({
    importRecipe: vi.fn(),
    importRecipeWithAI: vi.fn(),
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: false,
  }),
}));

vi.mock("@heroui/react", () => ({
  Modal: (props: any) => {
    modalMock(props);

    return props.isOpen ? <div>{props.children}</div> : null;
  },
  ModalContent: ({ children }: any) =>
    typeof children === "function" ? <div>{children(vi.fn())}</div> : <div>{children}</div>,
  ModalHeader: ({ children }: any) => <div>{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalFooter: ({ children }: any) => <div>{children}</div>,
  Input: ({ value, onChange, label, placeholder, type }: any) => (
    <input
      aria-label={label}
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={onChange}
    />
  ),
  Button: ({ children, onPress }: any) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  addToast: vi.fn(),
}));

describe("ImportRecipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders above desktop menu and overlay stacks", () => {
    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    expect(modalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        classNames: {
          wrapper: "z-[1100]",
          backdrop: "z-[1099]",
        },
      })
    );
  });

  it("fills the URL input from clipboard when modal opens", async () => {
    const readText = vi.fn().mockResolvedValue("https://example.com/recipe");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("https://example.com/recipe");
    });
  });

  it("does not fill the URL input when clipboard text is not a URL", async () => {
    const readText = vi.fn().mockResolvedValue("just some text");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(readText).toHaveBeenCalled();
    });

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("does not overwrite an existing URL on reopen", async () => {
    const readText = vi.fn().mockResolvedValue("https://example.com/recipe");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });

    const { rerender } = render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("https://example.com/recipe");
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://my-custom-url.com" },
    });

    rerender(<ImportRecipeModal isOpen={false} onOpenChange={vi.fn()} />);
    rerender(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(readText).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("textbox")).toHaveValue("https://my-custom-url.com");
  });
});
