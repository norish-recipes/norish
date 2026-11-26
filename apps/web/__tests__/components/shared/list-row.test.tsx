import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ListFrame, ListRow } from "@/components/shared/list-row";
import { Section } from "@/components/shared/section";

describe("ListRow", () => {
  it("is one button with its name and count, and opens on press", async () => {
    const onPress = vi.fn();

    render(
      <ListFrame>
        <ListRow count="3 recipes" name="Diner" onPress={onPress} />
      </ListFrame>
    );
    await userEvent.click(screen.getByRole("button", { name: /^Diner.*3 recipes/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("names the lock it draws, and mirrors the chevron where text runs right to left", () => {
    render(
      <ListFrame>
        <ListRow chevron lockLabel="Read only" name="Italian" onPress={() => {}} />
      </ListFrame>
    );

    const row = screen.getByRole("button");

    expect(within(row).getByRole("img", { name: "Read only" })).toBeVisible();
    expect(row.querySelector("svg.rtl\\:rotate-180")).not.toBeNull();
  });
});

describe("ListRow two lines", () => {
  it("is a taller row with its detail under the name and its icon at the start", () => {
    render(
      <ListFrame>
        <ListRow
          detail="1 translation"
          leading={<i data-testid="icon" />}
          name="Salt"
          onPress={() => {}}
        />
      </ListFrame>
    );

    const row = screen.getByRole("button");

    expect(row).toHaveTextContent("Salt1 translation");
    expect(row.className).toContain("min-h-15");
    expect(row.firstElementChild).toBe(screen.getByTestId("icon"));
  });
});

describe("Section", () => {
  it("is a heading over its content, with help as a button whose label is the help", () => {
    render(
      <Section help="Kept by your server admin" placement="card" title="From your server">
        <p>rows</p>
      </Section>
    );
    expect(screen.getByRole("heading", { level: 3, name: /From your server/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Kept by your server admin" })).toBeVisible();
  });

  it("draws no heading for a part with no title", () => {
    render(
      <Section placement="card">
        <p>rows</p>
      </Section>
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
