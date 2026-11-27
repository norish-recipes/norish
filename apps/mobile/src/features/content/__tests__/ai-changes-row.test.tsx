// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({ counts: { total: 0, unsure: 0 } }));

vi.mock("@/components/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@norish/shared-react/ingredients", () => ({ useAIChangeCounts: () => held.counts }));

const { AiChangesRow } = await import("../components/ai-changes-row");

describe("AiChangesRow", () => {
  beforeEach(() => {
    held.counts = { total: 0, unsure: 0 };
  });

  it("is not there while AI changed nothing", () => {
    render(<AiChangesRow onPress={vi.fn()} />);
    expect(screen.queryByTestId("content-ai-changes")).toBeNull();
  });

  it("keeps the title and tags how many are left to check beside it", () => {
    held.counts = { total: 3, unsure: 1 };
    render(<AiChangesRow onPress={vi.fn()} />);
    expect(screen.getByTestId("content-ai-changes").textContent).toBe(
      'settings.ingredients.changedByAI.titlesettings.ingredients.changedByAI.toCheck{"count":1}'
    );
  });

  it("has no tag once every change is answered", () => {
    held.counts = { total: 3, unsure: 0 };
    render(<AiChangesRow onPress={vi.fn()} />);
    expect(screen.getByTestId("content-ai-changes").textContent).toBe(
      "settings.ingredients.changedByAI.title"
    );
  });
});
