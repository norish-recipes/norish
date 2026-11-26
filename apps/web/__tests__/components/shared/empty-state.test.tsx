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
});
