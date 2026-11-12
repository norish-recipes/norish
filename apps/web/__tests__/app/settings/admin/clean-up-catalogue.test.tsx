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

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useCleanUpCounts: () => counts.current,
  useCleanUpCatalogue: () => ({ start, isStarting: false }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const { default: CleanUpCatalogue } =
  await import("@/app/(app)/settings/admin/components/clean-up-catalogue");

beforeEach(() => {
  start.mockReset().mockResolvedValue(true);
  counts.current = { recipeFoods: 2, wholeCatalogue: 40, running: false };
  setConfigs({ ai_config: { enabled: true } });
});

describe("CleanUpCatalogue", () => {
  it("names each scope's count and starts the run over the one picked, closing once it started", async () => {
    render(<CleanUpCatalogue />);
    fireEvent.click(screen.getByTestId("clean-up-catalogue"));

    expect(screen.getByTestId("clean-up-count")).toHaveTextContent('count:{"count":2}');
    fireEvent.click(screen.getByRole("radio", { name: "scopes.whole-catalogue" }));
    expect(screen.getByTestId("clean-up-count")).toHaveTextContent('count:{"count":40}');
    fireEvent.click(screen.getByTestId("clean-up-catalogue-start"));

    expect(start).toHaveBeenCalledWith("whole-catalogue");
    await waitFor(() => expect(screen.queryByTestId("clean-up-catalogue-dialog")).toBeNull());
  });

  it("is disabled while a run is on, or AI is off", () => {
    counts.current = { recipeFoods: 2, wholeCatalogue: 40, running: true };
    const { unmount } = render(<CleanUpCatalogue />);

    expect(screen.getByTestId("clean-up-catalogue")).toBeDisabled();
    expect(screen.getByText("running")).toBeInTheDocument();
    unmount();

    counts.current = { recipeFoods: 2, wholeCatalogue: 40, running: false };
    configs.ai_config = { enabled: false };
    render(<CleanUpCatalogue />);
    expect(screen.getByTestId("clean-up-catalogue")).toBeDisabled();
  });
});
