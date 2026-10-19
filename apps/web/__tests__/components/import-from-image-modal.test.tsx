import type { ReactNode } from "react";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importRecipeFromImages: vi.fn(),
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipesMutations: () => ({ importRecipeFromImages: mocks.importRecipeFromImages }),
}));

vi.mock("@/hooks/config", () => ({
  useUploadLimitsQuery: () => ({ limits: { maxImageSize: 10 * 1024 * 1024 } }),
}));

vi.mock("@/hooks/use-clipboard-image-paste", () => ({
  useClipboardImagePaste: vi.fn(),
}));

vi.mock("@/lib/ui/safe-error-toast", () => ({
  showSafeErrorToast: vi.fn(),
}));

vi.mock("next-intl", () => {
  const messages = {
    title: "One recipe from photos",
    description: "The photos are combined into one recipe.",
    bulkPrompt: "Several recipes?",
    bulkLink: "Use Bulk images — one recipe per image",
  } as Record<string, string>;

  return { useTranslations: () => (key: string) => messages[key] ?? key };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a
      className={className}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string } & Record<string, unknown>) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@heroicons/react/16/solid", () => ({
  PhotoIcon: () => <span />,
  SparklesIcon: () => <span />,
  XMarkIcon: () => <span />,
}));

vi.mock("@heroui/react", () => {
  type Props = { children?: ReactNode } & Record<string, unknown>;

  const Modal = {
    Backdrop: ({ children, isOpen }: Props & { isOpen: boolean }) =>
      isOpen ? <div>{children}</div> : null,
    Container: ({ children }: Props) => <div>{children}</div>,
    Dialog: ({ children }: { children: () => ReactNode }) => <div>{children()}</div>,
    Header: ({ children }: Props) => <div>{children}</div>,
    Body: ({ children }: Props) => <div>{children}</div>,
    Footer: ({ children }: Props) => <div>{children}</div>,
    CloseTrigger: () => null,
  };
  const Button = ({ children, onPress }: Props & { onPress?: () => void }) => (
    <button onClick={onPress}>{children}</button>
  );
  const Kbd = ({ children }: Props) => <span>{children}</span>;

  return { Modal, Button, Kbd, toast: vi.fn() };
});

vi.mock("@/components/ui/drop-zone", () => {
  type Props = { children?: ReactNode } & Record<string, unknown>;

  const Frame = ({ children }: Props) => <div>{children}</div>;
  const Area = ({ children }: Props) => <div>{children}</div>;
  const Icon = ({ children }: Props) => <div>{children}</div>;
  const Label = ({ children }: Props) => <div>{children}</div>;
  const Description = ({ children }: Props) => <div>{children}</div>;
  const Trigger = ({ children }: Props) => <div>{children}</div>;
  const Input = () => <input type="file" />;

  return {
    DropZone: Object.assign(Frame, {
      Area,
      Icon,
      Label,
      Description,
      Trigger,
      Input,
    }),
  };
});

describe("ImportFromImageModal", () => {
  it("shows the bulk entry and closes when it is followed", () => {
    const onOpenChange = vi.fn();

    render(<ImportFromImageModal isOpen onOpenChange={onOpenChange} />);

    expect(screen.getByText("One recipe from photos")).toBeInTheDocument();
    expect(screen.getByText("The photos are combined into one recipe.")).toBeInTheDocument();
    expect(screen.getByText("Several recipes?")).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "Use Bulk images — one recipe per image",
    });

    expect(link).toHaveAttribute("href", "/recipes/import");

    fireEvent.click(link);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
