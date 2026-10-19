import type { ReactNode } from "react";
import BulkImageImport from "@/components/import/bulk-image-import";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      imageImportBatchStatus: {
        queryOptions: () => ({ queryKey: ["status"], queryFn: vi.fn() }),
        queryKey: () => ["status"],
      },
      importFromImagesBatch: { mutationOptions: (options: unknown) => options },
      retryImageBatchItems: { mutationOptions: (options: unknown) => options },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: true }),
}));

vi.mock("@/hooks/config", () => ({
  useUploadLimitsQuery: () => ({ limits: { maxImageSize: 10 * 1024 * 1024 } }),
}));

vi.mock("@/lib/ui/safe-error-toast", () => ({
  showSafeErrorToast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string } & Record<string, unknown>) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@heroicons/react/16/solid", () => ({
  ArrowPathIcon: () => <span />,
  CheckCircleIcon: () => <span />,
  ClockIcon: () => <span />,
  ExclamationCircleIcon: () => <span />,
  PhotoIcon: () => <span />,
  XMarkIcon: () => <span />,
}));

vi.mock("@heroui/react", () => {
  type Props = {
    children?: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
  } & Record<string, unknown>;

  const Button = ({ children, onPress, isDisabled }: Props) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  );
  const Chip = Object.assign(({ children }: Props) => <span>{children}</span>, {
    Label: ({ children }: Props) => <span>{children}</span>,
  });
  const ProgressBar = () => <div role="progressbar" />;

  return { Button, Chip, ProgressBar };
});

vi.mock("@/components/ui/drop-zone", () => {
  type Props = { children?: ReactNode } & Record<string, unknown>;

  const Frame = ({ children }: Props) => <div>{children}</div>;
  const Area = ({ children }: Props) => <div>{children}</div>;
  const Icon = ({ children }: Props) => <div>{children}</div>;
  const Label = ({ children }: Props) => <div>{children}</div>;
  const Description = ({ children }: Props) => <div>{children}</div>;
  const Trigger = ({ children }: Props) => <div>{children}</div>;
  const Input = ({
    onSelect,
  }: { onSelect: (files: FileList | null) => void } & Record<string, unknown>) => (
    <input
      data-testid="bulk-image-input"
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

describe("BulkImageImport", () => {
  beforeEach(() => {
    mocks.mutate.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("sends every selected image to the batch", () => {
    render(<BulkImageImport />);

    const files = ["one.png", "two.png", "three.png"].map(
      (name) => new File([new Uint8Array(4)], name, { type: "image/png" })
    );

    fireEvent.change(screen.getByTestId("bulk-image-input"), { target: { files } });
    fireEvent.click(screen.getByRole("button", { name: "importButton" }));

    const formData = mocks.mutate.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect([...(formData as FormData).keys()]).toEqual(["file0", "file1", "file2"]);
    expect((formData as FormData).getAll("file0")).toHaveLength(1);
    expect((formData as FormData).get("file2")).toBe(files[2]);
  });

  it("starts one upload for two same-tick import presses", () => {
    render(<BulkImageImport />);

    const file = new File([new Uint8Array(4)], "one.png", { type: "image/png" });

    fireEvent.change(screen.getByTestId("bulk-image-input"), { target: { files: [file] } });

    const button = screen.getByRole("button", { name: "importButton" });

    act(() => {
      button.click();
      button.click();
    });

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });
});
