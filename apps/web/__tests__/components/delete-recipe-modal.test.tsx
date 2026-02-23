import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";

const modalMock = vi.fn(({ children }: any) => <div>{children}</div>);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroui/react", () => ({
  Modal: (props: any) => modalMock(props),
  ModalContent: ({ children }: any) =>
    typeof children === "function" ? <div>{children(vi.fn())}</div> : <div>{children}</div>,
  ModalHeader: ({ children }: any) => <div>{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalFooter: ({ children }: any) => <div>{children}</div>,
  Button: ({ children }: any) => <button type="button">{children}</button>,
}));

describe("DeleteRecipeModal", () => {
  it("renders above the mobile nav stack", () => {
    render(<DeleteRecipeModal isOpen recipeName="Soup" onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(modalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        classNames: {
          wrapper: "z-[1100]",
          backdrop: "z-[1099]",
        },
      })
    );
  });
});
