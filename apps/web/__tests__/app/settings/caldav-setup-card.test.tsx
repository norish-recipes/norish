/**
 * Before CalDAV is configured, Test works as soon as the credentials are in and
 * nothing tests on a keystroke: a half-typed password failed and never retried (#703).
 */
import CalDavConfigCard from "@/app/(app)/settings/caldav/components/caldav-config-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const testConnection = vi.fn(async () => ({ success: false, message: "fetch failed" }));

vi.mock("@/app/(app)/settings/caldav/context", () => ({
  useCalDavSettingsContext: () => ({ config: null, saveConfig: vi.fn(), testConnection }),
}));

describe("CalDAV setup card", () => {
  it("tests only on Test, which needs no calendar picked", () => {
    render(<CalDavConfigCard />);
    const field = (name: string) => screen.getByPlaceholderText(`${name}Placeholder`);
    const test = screen.getByRole("button", { name: "test" });

    fireEvent.change(field("serverUrl"), {
      target: { value: "https://cloud.example/remote.php/dav" },
    });
    fireEvent.change(field("username"), { target: { value: "chef" } });
    expect(test).toBeDisabled();

    fireEvent.change(field("password"), { target: { value: "s" } });
    expect(testConnection).not.toHaveBeenCalled();
    expect(test).toBeEnabled();

    fireEvent.click(test);
    expect(testConnection).toHaveBeenCalledWith(
      "https://cloud.example/remote.php/dav",
      "chef",
      "s"
    );
  });
});
