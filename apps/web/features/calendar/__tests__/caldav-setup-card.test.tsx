/**
 * Before CalDAV is configured, Test works as soon as the credentials are in and
 * nothing tests on a keystroke: a half-typed password failed and never retried (#703).
 */
import CaldavConfigCard from "@/features/calendar/components/caldav/caldav-config-card";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const testConnection = vi.fn(async (..._args: unknown[]): Promise<Record<string, unknown>> => ({
  success: false,
  message: "fetch failed",
}));

vi.mock("@norish/shared-react/calendar", () => ({
  useCaldavConfigQuery: () => ({ config: null }),
  useCaldavMutations: () => ({
    saveConfig: vi.fn(),
    testConnection,
    isSavingConfig: false,
    isTestingConnection: false,
  }),
}));

describe("CalDAV setup card", () => {
  it("tests only on Test, which needs no calendar picked", () => {
    render(<CaldavConfigCard />);
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
    expect(testConnection).toHaveBeenCalledWith({
      serverUrl: "https://cloud.example/remote.php/dav",
      username: "chef",
      password: "s",
      trustedCertificate: null,
    });
  });

  it("tests again trusting the certificate the server was refused over (#703)", async () => {
    testConnection.mockResolvedValueOnce({
      success: false,
      message: "fetch failed: unable to get local issuer certificate",
      untrustedCertificate: { pem: "PEM", name: "nextcloud.internal", fingerprint: "AB:CD" },
    });
    render(<CaldavConfigCard />);
    const field = (name: string) => screen.getByPlaceholderText(`${name}Placeholder`);

    fireEvent.change(field("serverUrl"), { target: { value: "https://nextcloud.internal/dav" } });
    fireEvent.change(field("username"), { target: { value: "chef" } });
    fireEvent.change(field("password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "test" }));

    expect(await screen.findByText("AB:CD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "trust" }));

    await waitFor(() =>
      expect(testConnection).toHaveBeenLastCalledWith({
        serverUrl: "https://nextcloud.internal/dav",
        username: "chef",
        password: "secret",
        trustedCertificate: "PEM",
      })
    );
  });
});
