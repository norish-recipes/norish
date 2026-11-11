/**
 * The stored CalDAV password is read only while the edit modal is open, not on every visit to
 * the tab, which mounts the modal closed.
 */
import { fakeProcedure } from "@/__tests__/helpers/trpc-fake";
import CaldavConfigEditModal from "@/features/calendar/components/caldav/caldav-config-edit-modal";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const CONFIG = {
  serverUrl: "https://cal.example.com",
  calendarUrl: null,
  username: "chef",
  enabled: true,
  breakfastTime: "07:00-08:00",
  lunchTime: "12:00-13:00",
  dinnerTime: "18:00-19:00",
  snackTime: "15:00-16:00",
  trustedCertificate: null,
  version: 1,
};

describe("CaldavConfigEditModal", () => {
  it("reads the stored password only while open", () => {
    const queryClient = createTestQueryClient();
    const passwordReads = () =>
      queryClient.isFetching({ queryKey: fakeProcedure("caldav.getPassword").queryKey() });

    queryClient.setQueryData(fakeProcedure("caldav.getConfig").queryKey(), CONFIG);
    const { rerender } = render(<CaldavConfigEditModal isOpen={false} onClose={() => {}} />, {
      wrapper: createTestWrapper(queryClient),
    });

    expect(passwordReads()).toBe(0);

    rerender(<CaldavConfigEditModal isOpen onClose={() => {}} />);

    expect(passwordReads()).toBe(1);
  });
});
