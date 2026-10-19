import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modalMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const recipesMock = vi.hoisted(() => ({
  importRecipe: vi.fn(),
  importRecipeWithAI: vi.fn(),
}));

const userSettingsMock = vi.hoisted(() => ({
  user: { preferences: {} } as { preferences: Record<string, unknown> } | null,
  isLoading: false,
}));

vi.mock("@/context/recipes-context", () => ({
  useRecipesContext: () => recipesMock,
}));

vi.mock("@/hooks/user/use-user-query", () => ({
  useUserSettingsQuery: () => userSettingsMock,
}));

vi.mock("@/components/shared/auto-enrich-toggle", async () => {
  const actual = await vi.importActual<typeof import("@/components/shared/auto-enrich-toggle")>(
    "@/components/shared/auto-enrich-toggle"
  );

  return {
    ...actual,
    default: ({
      isSelected,
      onValueChange,
    }: {
      isSelected: boolean;
      onValueChange: (isSelected: boolean) => void;
    }) => (
      <button aria-pressed={isSelected} type="button" onClick={() => onValueChange(!isSelected)}>
        auto-enrich
      </button>
    ),
  };
});

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: false,
  }),
}));

vi.mock("@heroui/react", () => ({
  Modal: Object.assign(({ children }: any) => <>{children}</>, {
    Backdrop: ({ children, isOpen, ...props }: any) =>
      isOpen ? <div {...props}>{children}</div> : null,
    Container: (props: any) => {
      modalMock(props);

      return <div>{props.children}</div>;
    },
    Dialog: ({ children }: any) =>
      typeof children === "function" ? <div>{children(vi.fn())}</div> : <div>{children}</div>,
    CloseTrigger: () => <button aria-label="Close" type="button" />,
    Header: ({ children }: any) => <div>{children}</div>,
    Body: ({ children }: any) => <div>{children}</div>,
    Footer: ({ children }: any) => <div>{children}</div>,
  }),
  TextField: ({ children, value, onChange, type }: any) => {
    const childrenArray = Array.isArray(children) ? children : [children];
    const label = childrenArray.find((child) => child?.type?.name === "Label")?.props?.children;
    const input = childrenArray.find((child) => child?.type?.name === "Input");

    return (
      <input
        aria-label={label}
        placeholder={input?.props?.placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  },
  Label: ({ children }: any) => <span>{children}</span>,
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
  toast: vi.fn(),
}));

describe("ImportRecipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userSettingsMock.user = { preferences: {} };
    userSettingsMock.isLoading = false;
  });

  it("offers automatic AI on by default and passes the per-add override", async () => {
    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://example.com/recipe" },
    });

    const toggle = screen.getByRole("button", { name: "auto-enrich" });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);

    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipe).toHaveBeenCalledWith("https://example.com/recipe", {
        autoEnrich: false,
      });
    });
  });

  it("starts off and passes off when the profile turned automatic AI off", async () => {
    userSettingsMock.user = { preferences: { autoEnrichOnAdd: false } };

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "auto-enrich" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://example.com/recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipe).toHaveBeenCalledWith("https://example.com/recipe", {
        autoEnrich: false,
      });
    });
  });

  it("passes an on choice when the profile is resolved on", async () => {
    userSettingsMock.user = { preferences: { autoEnrichOnAdd: true } };

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://example.com/recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipe).toHaveBeenCalledWith("https://example.com/recipe", {
        autoEnrich: true,
      });
    });
  });

  it("passes no choice while the profile is loading", async () => {
    userSettingsMock.user = { preferences: { autoEnrichOnAdd: false } };
    userSettingsMock.isLoading = true;

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://example.com/recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipe).toHaveBeenCalledWith("https://example.com/recipe", {
        autoEnrich: undefined,
      });
    });
  });

  it("passes no choice when the profile query has no user", async () => {
    userSettingsMock.user = null;

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://example.com/recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipe).toHaveBeenCalledWith("https://example.com/recipe", {
        autoEnrich: undefined,
      });
    });
  });

  it("renders above desktop menu and overlay stacks", () => {
    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    expect(modalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "z-[1100]",
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
