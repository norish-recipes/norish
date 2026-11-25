import JoinHouseholdCard from "@/features/household/components/join-household-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const { joinHousehold } = vi.hoisted(() => ({ joinHousehold: vi.fn() }));

vi.mock("@norish/shared-react/reader", async (importActual) => ({
  ...(await importActual<typeof import("@norish/shared-react/reader")>()),
  useHouseholdMutations: () => ({ joinHousehold }),
}));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const typeCode = (code: string) =>
  fireEvent.change(screen.getByRole("textbox"), { target: { value: code } });
const submit = () => screen.getByRole("button", { name: /join.submitButton/ });

beforeEach(() => {
  joinHousehold.mockReset().mockResolvedValue(true);
});

describe("JoinHouseholdCard", () => {
  it("does not submit a short code", () => {
    render(<JoinHouseholdCard />);
    typeCode("123");

    expect(submit()).toBeDisabled();
    fireEvent.submit(submit().closest("form")!);
    expect(joinHousehold).not.toHaveBeenCalled();
  });

  it("submits a six-digit code", () => {
    render(<JoinHouseholdCard />);
    typeCode("123456");

    expect(submit()).toBeEnabled();
    fireEvent.click(submit());
    expect(joinHousehold).toHaveBeenCalledWith("123456");
  });
});
