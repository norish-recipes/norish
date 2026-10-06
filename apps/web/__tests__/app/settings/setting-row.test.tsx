import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import { SettingRow, SwitchRow } from "@/app/(app)/settings/components/setting-row";

/**
 * The rows exist for one reason: a phone has room for the text or the control,
 * not both side by side. These assert the classes that carry that, because the
 * layout is entirely in them — nothing else in the components can break.
 */
describe("SettingRow", () => {
  it("stacks the control under the text until sm", () => {
    const { container } = render(
      <SettingRow description="Who can see recipes" title="View recipes">
        <button type="button">control</button>
      </SettingRow>
    );
    const row = container.firstElementChild;

    expect(row).toHaveClass("flex-col");
    expect(row).toHaveClass("sm:flex-row");
  });

  it("lets the text column shrink so long prose never widens the row", () => {
    const { container } = render(
      <SettingRow description="A sentence long enough to want the whole line" title="Title">
        <button type="button">control</button>
      </SettingRow>
    );

    expect(container.querySelector(".min-w-0")).not.toBeNull();
  });

  it("gives the control the full width on a phone and one fixed width from sm", () => {
    render(
      <SettingRow title="Title">
        <button type="button">control</button>
      </SettingRow>
    );
    const control = screen.getByRole("button").parentElement;

    expect(control).toHaveClass("w-full");
    expect(control).toHaveClass("sm:w-72", "sm:shrink-0");
  });

  it("pushes a control that does not fill the line to the end of it", () => {
    render(
      <SettingRow title="Recipe Archive">
        <button type="button">Export Recipe Archive</button>
      </SettingRow>
    );

    expect(screen.getByRole("button").parentElement).toHaveClass("flex", "justify-end");
  });

  it("renders badges beside the title and omits an absent description", () => {
    render(
      <SettingRow badges={<span>Unsaved</span>} title="Title">
        <button type="button">control</button>
      </SettingRow>
    );

    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByText("Title").parentElement).toContainElement(screen.getByText("Unsaved"));
  });
});

describe("SwitchRow", () => {
  it("keeps the switch on the title's row and drops the description below it", () => {
    render(
      <SwitchRow description="When disabled, only existing users can sign in" title="Registration">
        <input aria-label="toggle" type="checkbox" />
      </SwitchRow>
    );
    const control = screen.getByLabelText("toggle").parentElement;
    const description = screen.getByText("When disabled, only existing users can sign in");

    expect(control).toHaveClass("row-start-1");
    expect(description).toHaveClass("row-start-2");
    // Full width under the switch on a phone, back beside it from sm.
    expect(description).toHaveClass("col-span-2");
    expect(description).toHaveClass("sm:col-span-1");
  });

  it("centres the switch against the whole block from sm up", () => {
    render(
      <SwitchRow description="Description" title="Title">
        <input aria-label="toggle" type="checkbox" />
      </SwitchRow>
    );

    expect(screen.getByLabelText("toggle").parentElement).toHaveClass("sm:row-span-2");
  });

  it("renders without a description", () => {
    render(
      <SwitchRow title="Title">
        <input aria-label="toggle" type="checkbox" />
      </SwitchRow>
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("toggle")).toBeInTheDocument();
  });
});
