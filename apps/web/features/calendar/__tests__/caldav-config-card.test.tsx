/**
 * Once CalDAV is configured the card shows the summary, and its Edit button
 * opens the edit modal, which can close itself again.
 */
import CaldavConfigCard from "@/features/calendar/components/caldav/caldav-config-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@norish/shared-react/calendar", () => ({
  useCaldavConfigQuery: () => ({ config: { serverUrl: "https://cal.example.com" } }),
  useCaldavMutations: () => ({ saveConfig: vi.fn(), isSavingConfig: false }),
}));

vi.mock("@/features/calendar/components/caldav/caldav-config-summary", () => ({
  default: ({ onEditClick }: { onEditClick: () => void }) => (
    <button type="button" onClick={onEditClick}>
      Edit
    </button>
  ),
}));

vi.mock("@/features/calendar/components/caldav/caldav-config-edit-modal", () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

describe("CaldavConfigCard", () => {
  it("opens the edit modal from the summary and closes it again", () => {
    render(<CaldavConfigCard />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
