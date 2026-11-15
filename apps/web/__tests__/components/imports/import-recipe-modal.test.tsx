import ImportRecipeModal from "@/components/imports/import-recipe-modal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const modalMock = vi.hoisted(() => vi.fn());
const importRecipe = vi.hoisted(() => vi.fn());
const useImportRecipe = vi.hoisted(() =>
  vi.fn(() => ({ importRecipe, importRecipeWithAI: vi.fn() }))
);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Its toasts and the trip to the Library are the shared hook's, tested with it.
vi.mock("@norish/shared-react/recipes", () => ({ useImportRecipe }));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("../../helpers/reader-mock")).mockReader()
);

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
  it("starts the import, which goes to the Library, and closes", async () => {
    const onOpenChange = vi.fn();

    render(<ImportRecipeModal isOpen onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://example.com/soup" },
    });
    fireEvent.click(screen.getByRole("button", { name: "import" }));

    expect(useImportRecipe).toHaveBeenCalledWith();
    expect(importRecipe).toHaveBeenCalledWith("https://example.com/soup");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
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
