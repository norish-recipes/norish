import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ConfirmModal", () => {
  it("puts the way out on the left and the primary on the right, under a bare title", () => {
    render(
      <ConfirmModal
        isOpen
        confirm={
          <ActionButton action="delete" variant="danger">
            Delete
          </ActionButton>
        }
        title="Delete it"
        onOpenChange={vi.fn()}
      >
        <p>Sure?</p>
      </ConfirmModal>
    );

    const buttons = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter(Boolean);

    expect(buttons).toEqual(["cancel", "Delete"]);
    expect(screen.getByText("Delete it")).toBeTruthy();
  });
});
