/**
 * Clean up catalogue: a scope, the count of foods it asks about, and a confirm that starts the run;
 * no run while AI is off or one is on.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { configs, setConfigs } from "./admin-config-fake";

const start = vi.fn();
const counts = vi.hoisted(() => ({ current: undefined as unknown }));
const running = vi.hoisted(() => ({ current: false }));
const opens = vi.hoisted(() => [] as boolean[]);

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useCleanUpCounts: (isOpen: boolean) => {
    opens.push(isOpen);

    return isOpen ? counts.current : undefined;
  },
  useCleanUpRunning: () => running.current,
  useCleanUpCatalogueMutation: () => ({ start, isStarting: false }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const { default: CleanUpCatalogue } =
  await import("@/features/admin/components/catalogue/clean-up-catalogue");

beforeEach(() => {
  start.mockReset().mockResolvedValue(true);
  opens.length = 0;
  running.current = false;
  counts.current = { recipeFoods: 2, wholeCatalogue: 40 };
  setConfigs({ ai_config: { enabled: true } });
});

describe("CleanUpCatalogue", () => {
  it("does not count the catalogue until its dialog opens", () => {
    render(<CleanUpCatalogue />);

    expect(opens.every((isOpen) => !isOpen)).toBe(true);
    fireEvent.click(screen.getByTestId("clean-up-catalogue"));
    expect(opens.at(-1)).toBe(true);
  });

  it("names each scope's count and starts the run over the one picked, closing once it started", async () => {
    render(<CleanUpCatalogue />);
    fireEvent.click(screen.getByTestId("clean-up-catalogue"));

    expect(screen.getByTestId("clean-up-count")).toHaveTextContent('count:{"count":2}');
    fireEvent.click(screen.getByRole("radio", { name: "scopes.whole-catalogue" }));
    expect(screen.getByTestId("clean-up-count")).toHaveTextContent('count:{"count":40}');
    fireEvent.click(screen.getByTestId("clean-up-catalogue-start"));

    expect(start).toHaveBeenCalledWith({ scope: "whole-catalogue" });
    await waitFor(() => expect(screen.queryByTestId("clean-up-catalogue-dialog")).toBeNull());
  });

  it("is disabled while a run is on, or AI is off", () => {
    running.current = true;
    const { unmount } = render(<CleanUpCatalogue />);

    expect(screen.getByTestId("clean-up-catalogue")).toBeDisabled();
    expect(screen.getByText("running")).toBeInTheDocument();
    unmount();

    running.current = false;
    configs.ai_config = { enabled: false };
    render(<CleanUpCatalogue />);
    expect(screen.getByTestId("clean-up-catalogue")).toBeDisabled();
  });
});
