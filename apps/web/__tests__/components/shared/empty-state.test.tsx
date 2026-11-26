import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PlusIcon } from "@heroicons/react/24/outline";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("EmptyState", () => {
  it("is a muted icon and a title in one row, with its action at the end and no description", () => {
    render(
      <EmptyState
        action={<ActionButton action="add">Add</ActionButton>}
        data-testid="none-yet"
        icon={PlusIcon}
        title="No tags yet"
        variant="row"
      />
    );

    const row = screen.getByTestId("none-yet");
    const [icon, title, action] = Array.from(row.children);

    expect(icon!.tagName.toLowerCase()).toBe("svg");
    expect(icon!.getAttribute("class")).toContain("text-muted");
    expect(title!.textContent).toBe("No tags yet");
    expect(action!.textContent).toBe("Add");
    expect(row.children).toHaveLength(3);
  });

  it("is a heading on a page and a paragraph inside a card, with the icon hidden", () => {
    const { rerender } = render(<EmptyState icon={PlusIcon} title="Nothing" variant="page" />);

    expect(screen.getByRole("heading", { name: "Nothing" })).toBeTruthy();
    expect(document.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");

    rerender(<EmptyState icon={PlusIcon} title="Nothing" variant="row" />);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("keeps each variant's spacing in the template: page card, flat row, padded cell", () => {
    const wrapper = (variant: "page" | "row" | "cell") => {
      const { container, unmount } = render(
        <EmptyState data-testid="e" icon={PlusIcon} title="Nothing" variant={variant} />
      );
      const row = screen.getByTestId("e");
      const outer = (container.firstElementChild as HTMLElement)!;

      unmount();

      return {
        row: row.className,
        outer: outer.className,
        card: outer.firstElementChild?.className ?? "",
      };
    };

    expect(wrapper("page").outer).toContain("px-4 py-20");
    expect(wrapper("page").card).toContain("max-w-xl");
    expect(wrapper("cell").outer).toBe("px-4 py-6");
    expect(wrapper("row").row).toBe("flex min-h-9 items-center gap-2.5");
    expect(wrapper("row").row).not.toMatch(/\b(p|px|py|m|mx|my)-/);
  });
});
