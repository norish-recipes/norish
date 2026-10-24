/**
 * Once CalDAV is configured the card shows the summary, and its Edit button
 * opens the edit modal, which can close itself again.
 */
import CalDavConfigCard from "@/app/(app)/settings/caldav/components/caldav-config-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(app)/settings/caldav/context", () => ({
  useCalDavSettingsContext: () => ({
    config: { serverUrl: "https://cal.example.com" },
    saveConfig: vi.fn(),
    testConnection: vi.fn(),
  }),
}));

vi.mock("@/app/(app)/settings/caldav/components/caldav-config-summary", () => ({
  default: ({ onEditClick }: { onEditClick: () => void }) => (
    <button type="button" onClick={onEditClick}>
      Edit
    </button>
  ),
}));

vi.mock("@/app/(app)/settings/caldav/components/caldav-config-edit-modal", () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

describe("CalDavConfigCard", () => {
  it("opens the edit modal from the summary and closes it again", () => {
    render(<CalDavConfigCard />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
