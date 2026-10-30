import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import StarRating from "@norish/ui/star-rating";

describe("StarRating", () => {
  it("renders 5 star buttons", () => {
    render(<StarRating value={null} onChange={() => {}} />);

    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
  });

  it("calls onChange with the clicked star value when allowClear is false", () => {
    const handleChange = vi.fn();
    render(<StarRating allowClear={false} value={4} onChange={handleChange} />);

    const star4 = screen.getByRole("button", { name: "Rate 4 out of 5" });
    fireEvent.click(star4);

    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it("calls onChange with null when clicking the active rating with allowClear=true", () => {
    const handleChange = vi.fn();
    render(<StarRating allowClear value={4} onChange={handleChange} />);

    const star4 = screen.getByRole("button", { name: "Rate 4 out of 5" });
    fireEvent.click(star4);

    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with the new star value when clicking a different star with allowClear=true", () => {
    const handleChange = vi.fn();
    render(<StarRating allowClear value={4} onChange={handleChange} />);

    const star2 = screen.getByRole("button", { name: "Rate 2 out of 5" });
    fireEvent.click(star2);

    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it("calls onChange with the clicked star when allowClear is false dynamically", () => {
    const handleChange = vi.fn();
    const userRating: number | null = null;
    const averageRating = 4;

    render(
      <StarRating
        allowClear={userRating !== null}
        value={userRating ?? averageRating}
        onChange={handleChange}
      />
    );

    const star4 = screen.getByRole("button", { name: "Rate 4 out of 5" });
    fireEvent.click(star4);

    expect(handleChange).toHaveBeenCalledWith(4);
  });
});
