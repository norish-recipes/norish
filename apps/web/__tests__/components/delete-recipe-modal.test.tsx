import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const modalMock = vi.fn(({ children }: any) => <div>{children}</div>);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroui/react", () => ({
  Modal: Object.assign(({ children }: any) => <>{children}</>, {
    Backdrop: ({ children, isOpen, ...props }: any) =>
      isOpen ? <div {...props}>{children}</div> : null,
    Container: (props: any) => modalMock(props),
    Dialog: ({ children }: any) =>
      typeof children === "function" ? <div>{children(vi.fn())}</div> : <div>{children}</div>,
    Header: ({ children }: any) => <div>{children}</div>,
    Body: ({ children }: any) => <div>{children}</div>,
    Footer: ({ children }: any) => <div>{children}</div>,
  }),
  Button: ({ children }: any) => <button type="button">{children}</button>,
}));

describe("DeleteRecipeModal", () => {
  it("renders above the mobile nav stack", () => {
    render(<DeleteRecipeModal isOpen recipeName="Soup" onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(modalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "z-[1100]",
      })
    );
  });
});
