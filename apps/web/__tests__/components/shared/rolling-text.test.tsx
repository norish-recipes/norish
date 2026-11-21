/** One slot per character must not read "25" as "52" on an RTL page, and Arabic is never
 * split, since its joined letters would each show in isolated form. */
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
