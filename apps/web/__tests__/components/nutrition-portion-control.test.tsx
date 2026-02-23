import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock HeroUI components
vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress, "aria-label": ariaLabel, ...props }: any) => (
    <button aria-label={ariaLabel} onClick={onPress} {...props}>
      {children}
    </button>
  ),
}));

// Mock Heroicons
vi.mock("@heroicons/react/16/solid", () => ({
  MinusIcon: () => <span data-testid="minus-icon">-</span>,
  PlusIcon: () => <span data-testid="plus-icon">+</span>,
}));

import NutritionPortionControl from "@/components/recipes/nutrition-portion-control";

describe("NutritionPortionControl", () => {
  let onChange: ReturnType<typeof vi.fn<(portions: number) => void>>;

  beforeEach(() => {
    onChange = vi.fn<(portions: number) => void>();
  });

  describe("rendering", () => {
    it("renders with initial portions value", () => {
      render(<NutritionPortionControl portions={1} onChange={onChange} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByLabelText("Decrease portions")).toBeInTheDocument();
      expect(screen.getByLabelText("Increase portions")).toBeInTheDocument();
    });

    it("displays fractional portions correctly", () => {
      render(<NutritionPortionControl portions={0.5} onChange={onChange} />);
      expect(screen.getByText("0.5")).toBeInTheDocument();
    });

    it("displays whole numbers without decimal places", () => {
      render(<NutritionPortionControl portions={4} onChange={onChange} />);
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("removes trailing zeros from decimal numbers", () => {
      render(<NutritionPortionControl portions={2.5} onChange={onChange} />);
      expect(screen.getByText("2.5")).toBeInTheDocument();
    });
  });

  describe("incrementing portions", () => {
    it("increments by 1 for values >= 1", () => {
      render(<NutritionPortionControl portions={1} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Increase portions"));

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it("increments from 4 to 5", () => {
      render(<NutritionPortionControl portions={4} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Increase portions"));

      expect(onChange).toHaveBeenCalledWith(5);
    });

    it("doubles values < 1 (0.25 -> 0.5)", () => {
      render(<NutritionPortionControl portions={0.25} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Increase portions"));

      expect(onChange).toHaveBeenCalledWith(0.5);
    });

    it("doubles 0.5 to 1", () => {
      render(<NutritionPortionControl portions={0.5} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Increase portions"));

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("caps doubling at 1 for values between 0.5 and 1", () => {
      render(<NutritionPortionControl portions={0.75} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Increase portions"));

      expect(onChange).toHaveBeenCalledWith(1);
    });
  });

  describe("decrementing portions", () => {
    it("decrements by 1 for values > 2", () => {
      render(<NutritionPortionControl portions={5} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(4);
    });

    it("decrements from 2 to 1", () => {
      render(<NutritionPortionControl portions={2} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("goes from 1.5 to 1", () => {
      render(<NutritionPortionControl portions={1.5} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("halves values <= 1 (1 -> 0.5)", () => {
      render(<NutritionPortionControl portions={1} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(0.5);
    });

    it("halves 0.5 to 0.25", () => {
      render(<NutritionPortionControl portions={0.5} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(0.25);
    });

    it("halves 0.25 to 0.125", () => {
      render(<NutritionPortionControl portions={0.25} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(0.125);
    });

    it("does not go below 0.125", () => {
      render(<NutritionPortionControl portions={0.125} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText("Decrease portions"));

      expect(onChange).toHaveBeenCalledWith(0.125);
    });
  });

  describe("independence from ingredient servings", () => {
    it("maintains its own state independent of any context", () => {
      // This test verifies the component is controlled via props
      // and doesn't depend on any context
      const { rerender } = render(<NutritionPortionControl portions={1} onChange={onChange} />);

      expect(screen.getByText("1")).toBeInTheDocument();

      // Parent can update portions independently
      rerender(<NutritionPortionControl portions={4} onChange={onChange} />);
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });
});
