/**
 * The time fields take digits only: a key that would type anything else is
 * stopped, while editing, navigation and the clipboard shortcuts pass.
 */
import TimeInputs from "@/components/recipes/time-inputs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

type Press = {
  key: string;
  keyCode: number;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
};

function typed(press: Press): boolean {
  render(<TimeInputs onChange={() => {}} />);

  // fireEvent reports false when a handler called preventDefault.
  return fireEvent.keyDown(screen.getAllByPlaceholderText("0")[0]!, press);
}

describe("TimeInputs", () => {
  it.each<Press>([
    { key: "5", keyCode: 53 },
    { key: "5", keyCode: 101 },
    { key: "Backspace", keyCode: 8 },
    { key: "Delete", keyCode: 46 },
    { key: "Tab", keyCode: 9 },
    { key: "Enter", keyCode: 13 },
    { key: "Escape", keyCode: 27 },
    { key: "ArrowLeft", keyCode: 37 },
    { key: "Home", keyCode: 36 },
    { key: "v", keyCode: 86, ctrlKey: true },
    { key: "a", keyCode: 65, ctrlKey: true },
    // Ctrl+V on a Cyrillic layout: the key reads "м", the physical key is still V.
    { key: "м", keyCode: 86, code: "KeyV", ctrlKey: true },
  ])("lets $key through", (press) => {
    expect(typed(press)).toBe(true);
  });

  it.each<Press>([
    { key: "a", keyCode: 65 },
    { key: "e", keyCode: 69 },
    { key: "-", keyCode: 189 },
    { key: "!", keyCode: 49, shiftKey: true },
    { key: "z", keyCode: 90, ctrlKey: true },
  ])("stops $key", (press) => {
    expect(typed(press)).toBe(false);
  });
});
