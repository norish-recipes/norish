import type { ReactNode } from "react";
import { ScreenWakeLock, usePageWakeLock } from "@/app/(app)/recipes/[id]/components/page-wake-lock";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecipePageProvider } from "@norish/shared-react/recipes";

function browserAnswers() {
  const answers: { grant: (lock: unknown) => void; refuse: (err: unknown) => void }[] = [];

  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: () => new Promise((grant, refuse) => answers.push({ grant, refuse })),
    },
  });

  return answers;
}

const lock = () => ({
  release: vi.fn(async () => {}),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

function renderOnPage() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RecipePageProvider recipeId="recipe-1">
      <ScreenWakeLock />
      {children}
    </RecipePageProvider>
  );

  return renderHook(() => usePageWakeLock(), { wrapper });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("the page's wake lock", () => {
  it("shows on only once the browser grants the lock", async () => {
    const answers = browserAnswers();
    const { result } = renderOnPage();

    act(() => result.current.enable());
    expect(result.current.isActive).toBe(false);

    await act(async () => answers[0]?.grant(lock()));
    expect(result.current.isActive).toBe(true);
  });

  it("never shows on when the browser refuses", async () => {
    const answers = browserAnswers();
    const { result } = renderOnPage();

    act(() => result.current.enable());
    expect(result.current.isActive).toBe(false);

    await act(async () => answers[0]?.refuse(new Error("NotAllowedError")));
    expect(result.current.isActive).toBe(false);
  });
});
