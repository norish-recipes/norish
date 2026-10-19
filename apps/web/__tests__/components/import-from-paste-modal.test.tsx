import ImportFromPasteModal from "@/components/shared/import-from-paste-modal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recipesMock = vi.hoisted(() => ({
  importRecipeFromPaste: vi.fn(),
  importRecipeFromPasteWithAI: vi.fn(),
}));

const userSettingsMock = vi.hoisted(() => ({
  user: { preferences: {} as Record<string, unknown> } as {
    preferences: Record<string, unknown>;
  } | null,
  isLoading: false,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: false }),
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipesMutations: () => recipesMock,
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

vi.mock("@heroui/react", () => ({
  Modal: Object.assign(({ children }: any) => <>{children}</>, {
    Backdrop: ({ children, isOpen }: any) => (isOpen ? <div>{children}</div> : null),
    Container: ({ children }: any) => <div>{children}</div>,
    Dialog: ({ children }: any) =>
      typeof children === "function" ? <div>{children(vi.fn())}</div> : <div>{children}</div>,
    CloseTrigger: () => <button aria-label="Close" type="button" />,
    Header: ({ children }: any) => <div>{children}</div>,
    Body: ({ children }: any) => <div>{children}</div>,
    Footer: ({ children }: any) => <div>{children}</div>,
  }),
  TextField: ({ value, onChange }: any) => (
    <textarea
      aria-label="recipe"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  TextArea: () => null,
  Label: () => null,
  Button: ({ children, isDisabled, onPress }: any) => (
    <button disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  toast: vi.fn(),
}));

describe("ImportFromPasteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userSettingsMock.user = { preferences: {} };
    userSettingsMock.isLoading = false;
  });

  it("offers automatic AI on by default and passes the per-add override", async () => {
    render(<ImportFromPasteModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pasted recipe" } });

    const toggle = screen.getByRole("button", { name: "auto-enrich" });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);

    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipeFromPaste).toHaveBeenCalledWith("Pasted recipe", {
        autoEnrich: false,
      });
    });
  });

  it("starts off and passes off when the profile turned automatic AI off", async () => {
    userSettingsMock.user = { preferences: { autoEnrichOnAdd: false } };

    render(<ImportFromPasteModal isOpen onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "auto-enrich" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pasted recipe" } });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipeFromPaste).toHaveBeenCalledWith("Pasted recipe", {
        autoEnrich: false,
      });
    });
  });

  it("passes no choice while the profile is loading", async () => {
    userSettingsMock.user = { preferences: { autoEnrichOnAdd: false } };
    userSettingsMock.isLoading = true;

    render(<ImportFromPasteModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pasted recipe" } });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(recipesMock.importRecipeFromPaste).toHaveBeenCalledWith("Pasted recipe", {
        autoEnrich: undefined,
      });
    });
  });
});
