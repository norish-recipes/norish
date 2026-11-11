/**
 * The connection badge shows the check the query holds: a check under way reads "checking",
 * and its answer shows as soon as it lands. The enable switch keeps every other field.
 */
import CaldavConfigSummary from "@/features/calendar/components/caldav/caldav-config-summary";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const connection = vi.hoisted(() => ({
  current: { isChecking: true, isConnected: false },
}));
const saveConfig = vi.hoisted(() => vi.fn(async () => true));
const config = vi.hoisted(() => ({
  userId: "u1",
  serverUrl: "https://cal.example.com",
  calendarUrl: "https://cal.example.com/home/",
  username: "mike",
  trustedCertificate: "PEM",
  enabled: true,
  breakfastTime: "07:00-08:00",
  lunchTime: "12:00-13:00",
  dinnerTime: "18:00-19:00",
  snackTime: "15:00-16:00",
  version: 3,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

vi.mock("@norish/shared-react/calendar", () => ({
  useCaldavConfigQuery: () => ({ config }),
  useCaldavMutations: () => ({ saveConfig, deleteConfig: vi.fn() }),
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

  it("disabling keeps the chosen calendar and the trusted certificate", () => {
    render(<CaldavConfigSummary onEditClick={() => {}} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        password: "",
        calendarUrl: config.calendarUrl,
        trustedCertificate: config.trustedCertificate,
        serverUrl: config.serverUrl,
        username: config.username,
      })
    );
  });
});
