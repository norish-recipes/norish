import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import { Note } from "@/components/shared/note";

describe("Note", () => {
  it("draws one icon: a given icon replaces the lock", () => {
    const { container } = render(
      <Note icon={(props) => <svg data-testid="merge" {...props} />} locked>
        Merging moves its recipes.
      </Note>
    );

    expect(screen.getByTestId("merge")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
