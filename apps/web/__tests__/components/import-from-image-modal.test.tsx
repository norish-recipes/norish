import type { ReactNode } from "react";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportBatchDTO } from "@norish/shared/contracts";

const mocks = vi.hoisted(() => ({
  batch: {
    batchId: "batch-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [],
  } as ImageImportBatchDTO,
  importRecipeFromImages: vi.fn(),
  bulkMutate: vi.fn(),
  setQueryData: vi.fn(),
  trackBatch: vi.fn(),
  toast: vi.fn(),
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

vi.mock("@/context/bulk-import-context", () => ({
  useBulkImport: () => ({ trackBatch: mocks.trackBatch }),
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      importFromImagesBatch: { mutationOptions: (options: unknown) => options },
      imageImportBatchStatus: {
        queryKey: ({ batchId }: { batchId: string }) => ["status", batchId],
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { onSuccess?: (batch: ImageImportBatchDTO) => void }) => ({
    mutate: (variables: unknown) => {
      mocks.bulkMutate(variables);
      options.onSuccess?.(mocks.batch);
    },
    isPending: false,
  }),
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
}));

vi.mock("@/components/shared/auto-enrich-toggle", async () => {
  const React = await import("react");

  const AutoEnrichToggle = ({
    isSelected,
    onValueChange,
  }: {
    isSelected: boolean | undefined;
    onValueChange: (selected: boolean) => void;
  }) => (
    <button
      data-testid="auto-enrich-toggle"
      type="button"
      onClick={() => onValueChange(!isSelected)}
    >
      {`Enhanced:${String(isSelected)}`}
    </button>
  );

  function useAutoEnrichOnAdd(): [boolean, (enabled: boolean) => void] {
    const [enabled, setEnabled] = React.useState(true);

    return [enabled, setEnabled];
  }

  return { default: AutoEnrichToggle, useAutoEnrichOnAdd };
});

vi.mock("next-intl", () => {
  const messages: Record<string, string> = {
    title: "One recipe from photos",
    description: "The photos are combined into one recipe.",
    "mode.label": "Import mode",
    "mode.single": "One recipe from photos",
    "mode.bulk": "Bulk images",
    bulkDescription: "Each image becomes its own recipe.",
    bulkSelectedCount: "Bulk selected count",
    selectedCount: "Selected count",
    importWithAI: "Import with AI",
    failed: "Import failed",
    technicalDetails: "technical details",
  };

  return {
    useTranslations: () => (key: string) => messages[key] ?? key,
  };
});

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
  const Button = ({
    children,
    isDisabled,
    onPress,
    "aria-pressed": ariaPressed,
  }: Props & {
    isDisabled?: boolean;
    onPress?: () => void;
    "aria-pressed"?: boolean;
  }) => (
    <button aria-pressed={ariaPressed} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  );
  const Kbd = ({ children }: Props) => <span>{children}</span>;

  return { Modal, Button, Kbd, toast: mocks.toast };
});

vi.mock("@/components/ui/drop-zone", () => {
  type Props = { children?: ReactNode } & Record<string, unknown>;

  const Frame = ({ children }: Props) => <div>{children}</div>;
  const Area = ({ children }: Props) => <div>{children}</div>;
  const Icon = ({ children }: Props) => <div>{children}</div>;
  const Label = ({ children }: Props) => <div>{children}</div>;
  const Description = ({ children }: Props) => <div>{children}</div>;
  const Trigger = ({ children }: Props) => <div>{children}</div>;
  const Input = ({ onSelect }: { onSelect: (files: FileList | null) => void }) => (
    <input
      data-testid="image-input"
      type="file"
      onChange={(event) => onSelect(event.target.files)}
    />
  );

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

function imageFile(name: string): File {
  return new File([new Uint8Array(4)], name, { type: "image/png" });
}

function addFiles(files: File[]): void {
  fireEvent.change(screen.getByTestId("image-input"), { target: { files } });
}

beforeEach(() => {
  mocks.importRecipeFromImages.mockReset();
  mocks.bulkMutate.mockReset();
  mocks.setQueryData.mockReset();
  mocks.trackBatch.mockReset();
  mocks.toast.mockReset();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("ImportFromImageModal", () => {
  it("offers both import modes and the Enhanced toggle, with no bulk link", () => {
    render(<ImportFromImageModal isOpen onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "One recipe from photos" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Bulk images" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByTestId("auto-enrich-toggle")).toBeInTheDocument();
    expect(screen.queryByText("Use Bulk images — one recipe per image")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("submits one recipe from the selected photos with the Enhanced choice", () => {
    const onOpenChange = vi.fn();

    render(<ImportFromImageModal isOpen onOpenChange={onOpenChange} />);

    const files = [imageFile("one.png"), imageFile("two.png")];

    addFiles(files);
    fireEvent.click(screen.getByTestId("auto-enrich-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Import with AI" }));

    expect(mocks.importRecipeFromImages).toHaveBeenCalledWith(files, { autoEnrich: false });
    expect(mocks.bulkMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits one batch in bulk mode, registers it, and closes", () => {
    const onOpenChange = vi.fn();

    render(<ImportFromImageModal isOpen onOpenChange={onOpenChange} />);

    const files = [imageFile("one.png"), imageFile("two.png")];

    addFiles(files);
    fireEvent.click(screen.getByRole("button", { name: "Bulk images" }));
    fireEvent.click(screen.getByTestId("auto-enrich-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Import with AI" }));

    const formData = mocks.bulkMutate.mock.calls[0]?.[0] as FormData;

    expect(formData).toBeInstanceOf(FormData);
    expect([...formData.keys()]).toEqual(["file0", "file1", "autoEnrich"]);
    expect(formData.get("file0")).toBe(files[0]);
    expect(formData.get("file1")).toBe(files[1]);
    expect(formData.get("autoEnrich")).toBe("false");
    expect(mocks.trackBatch).toHaveBeenCalledWith("batch-1", files);
    expect(mocks.setQueryData).toHaveBeenCalledWith(["status", "batch-1"], mocks.batch);
    expect(mocks.importRecipeFromImages).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit an empty selection", () => {
    render(<ImportFromImageModal isOpen onOpenChange={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Import with AI" });

    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(mocks.importRecipeFromImages).not.toHaveBeenCalled();
    expect(mocks.bulkMutate).not.toHaveBeenCalled();
  });

  it("keeps an unsupported image out of the batch", () => {
    render(<ImportFromImageModal isOpen onOpenChange={vi.fn()} />);

    addFiles([new File(["not an image"], "list.txt", { type: "text/plain" })]);
    fireEvent.click(screen.getByRole("button", { name: "Import with AI" }));

    expect(mocks.toast).toHaveBeenCalled();
    expect(mocks.bulkMutate).not.toHaveBeenCalled();
    expect(mocks.importRecipeFromImages).not.toHaveBeenCalled();
  });
});
