import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal, { ModalFrame } from "@/components/shared/confirm-modal";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ConfirmModal", () => {
  it("holds Cancel in the start slot and the primary in the end slot, under a bare title", () => {
    render(
      <ConfirmModal
        isOpen
        confirm={
          <ActionButton action="delete" variant="danger">
            Delete
          </ActionButton>
        }
        data-testid="modal"
        start={<ActionButton action="remove">Remove</ActionButton>}
        title="Delete it"
        onOpenChange={vi.fn()}
      >
        <p>Sure?</p>
      </ConfirmModal>
    );

    const cancel = screen.getByRole("button", { name: "cancel" });
    const start = cancel.parentElement!;
    const end = screen.getByRole("button", { name: "Delete" }).parentElement!;

    expect(start.nextElementSibling).toBe(end);
    expect(
      within(start)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["cancel", "Remove"]);
    expect(within(end).getAllByRole("button")).toHaveLength(1);

    const dialog = screen.getByRole("dialog", { name: "Delete it" });

    expect(dialog).toBe(screen.getByTestId("modal"));

    expect(screen.getByText("Delete it").textContent).toBe("Delete it");
    expect(Array.from(dialog.querySelectorAll("p")).map((p) => p.textContent)).toEqual(["Sure?"]);
  });

  it("keeps the default width and sets the wide one with its height limit only when asked", () => {
    const { rerender } = render(
      <ModalFrame isOpen data-testid="frame" onOpenChange={vi.fn()}>
        {() => <p>Body</p>}
      </ModalFrame>
    );

    expect(screen.getByTestId("frame").className).not.toContain("max-w-3xl");

    rerender(
      <ModalFrame wide isOpen data-testid="frame" onOpenChange={vi.fn()}>
        {() => <p>Body</p>}
      </ModalFrame>
    );

    expect(screen.getByTestId("frame").className).toContain("max-w-3xl");
    expect(screen.getByTestId("frame").className).toContain("max-h-[85vh]");
  });
});
