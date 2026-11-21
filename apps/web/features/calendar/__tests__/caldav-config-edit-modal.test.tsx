/**
 * The stored CalDAV password is read only while the edit modal is open, not on every visit to
 * the tab, which mounts the modal closed; closing it drops the password from the cache.
 */
import {
  fakeProcedure,
  readAnswers,
  sentReads,
  sentWrites,
  writeAnswers,
} from "@/__tests__/helpers/trpc-fake";
import CaldavConfigEditModal from "@/features/calendar/components/caldav/caldav-config-edit-modal";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import "@testing-library/jest-dom";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const CONFIG = {
  serverUrl: "https://cal.example.com",
  calendarUrl: null as string | null,
  username: "chef",
  enabled: true,
  breakfastTime: "07:00-08:00",
  lunchTime: "12:00-13:00",
  dinnerTime: "18:00-19:00",
  snackTime: "15:00-16:00",
  trustedCertificate: null,
  version: 1,
};

const passwordReads = () =>
  sentReads.mock.calls.filter(([path]) => path === "caldav.getPassword").length;

describe("CaldavConfigEditModal", () => {
  beforeEach(() => {
    sentReads.mockClear();
    sentWrites.mockClear();
    readAnswers.clear();
    writeAnswers.clear();
  });

  const configKey = fakeProcedure("caldav.getConfig").queryKey();
  const renderOpen = (config = CONFIG) => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(configKey, config);
    render(<CaldavConfigEditModal isOpen onClose={() => {}} />, {
      wrapper: createTestWrapper(queryClient),
    });

    return queryClient;
  };

  it("shows a failed test when the stored password can't be read", async () => {
    readAnswers.set("caldav.getPassword", () => Promise.reject(new Error("offline")));
    writeAnswers.set("caldav.testConnection", async () => ({
      success: false,
      message: "Unauthorized",
    }));
    renderOpen();

    fireEvent.click(screen.getByRole("button", { name: "test" }));

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
    expect(sentWrites).toHaveBeenCalledWith(
      "caldav.testConnection",
      expect.objectContaining({ password: "" })
    );
  });

  it("shows a config changed elsewhere while open, and saves that", async () => {
    const config = { ...CONFIG, calendarUrl: "https://cal.example.com/home/" };
    const queryClient = renderOpen(config);

    act(() => queryClient.setQueryData(configKey, { ...config, username: "sous", version: 2 }));

    expect(await screen.findByDisplayValue("sous")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(sentWrites).toHaveBeenCalledWith(
        "caldav.saveConfig",
        expect.objectContaining({ username: "sous", version: 2 })
      )
    );
  });

  it("reads the stored password only while open", () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(fakeProcedure("caldav.getConfig").queryKey(), CONFIG);
    const { rerender } = render(<CaldavConfigEditModal isOpen={false} onClose={() => {}} />, {
      wrapper: createTestWrapper(queryClient),
    });

    expect(passwordReads()).toBe(0);

    rerender(<CaldavConfigEditModal isOpen onClose={() => {}} />);

    expect(passwordReads()).toBe(1);
  });

  it("holds no password in the cache once closed", async () => {
    const queryClient = createTestQueryClient();
    const passwordKey = fakeProcedure("caldav.getPassword").queryKey();

    readAnswers.set("caldav.getPassword", async () => "secret");
    queryClient.setQueryData(fakeProcedure("caldav.getConfig").queryKey(), CONFIG);
    const { rerender } = render(<CaldavConfigEditModal isOpen onClose={() => {}} />, {
      wrapper: createTestWrapper(queryClient),
    });

    await waitFor(() => expect(queryClient.getQueryData(passwordKey)).toBe("secret"));

    rerender(<CaldavConfigEditModal isOpen={false} onClose={() => {}} />);

    await waitFor(() => expect(queryClient.getQueryState(passwordKey)).toBeUndefined());
  });
});
