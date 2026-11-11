/**
 * The connection badge shows the check the query holds: a check under way reads "checking",
 * and its answer shows as soon as it lands.
 */
import CaldavConfigSummary from "@/features/calendar/components/caldav/caldav-config-summary";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const connection = vi.hoisted(() => ({
  current: { isChecking: true, isConnected: false, message: "", invalidate: () => {} },
}));

vi.mock("@norish/shared-react/calendar", () => ({
  useCaldavConfigQuery: () => ({
    config: { serverUrl: "https://cal.example.com", enabled: true },
  }),
  useCaldavMutations: () => ({ saveConfig: vi.fn(), deleteConfig: vi.fn() }),
  useCaldavConnectionQuery: () => connection.current,
}));

describe("CaldavConfigSummary", () => {
  it("shows the connection check under way, then its answer", () => {
    const { rerender } = render(<CaldavConfigSummary onEditClick={() => {}} />);

    expect(screen.getByText("connectionStatus.checking")).toBeInTheDocument();

    connection.current = { ...connection.current, isChecking: false, isConnected: true };
    rerender(<CaldavConfigSummary onEditClick={() => {}} />);

    expect(screen.getByText("connectionStatus.connected")).toBeInTheDocument();
  });
});
