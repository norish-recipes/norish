/**
 * RollingText splits a value into one slot per character, and a right-to-left
 * page would lay those slots out right to left: "25" read as "52". Arabic is
 * never split at all, since its letters join their neighbours and each would
 * show in its isolated form on its own.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import { RollingText } from "@/components/shared/rolling-text";

describe("RollingText", () => {
  it("keeps a number's slots left to right on a right-to-left page", () => {
    const { container } = render(
      <div dir="rtl">
        <RollingText isRising srValue="25" value="25" />
      </div>
    );
    const row = container.querySelector("[dir='ltr']");

    expect(row).not.toBeNull();
    expect([...row!.querySelectorAll("[aria-hidden]")].map((slot) => slot.textContent)).toEqual([
      "2",
      "5",
    ]);
  });

  it("rolls an Arabic word as one whole slot", () => {
    render(<RollingText isRising keyFrom="left" slots={12} value="وصفاتي" />);

    expect(screen.getByText("وصفاتي")).toBeInTheDocument();
  });
});
