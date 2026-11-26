/**
 * The System card's master key rotation: a confirmation that says every session ends before the
 * key is rotated, and in env mode the MASTER_KEY instruction in place of the button.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { setConfigs } from "./admin-config-fake";

const rotate = vi.fn();
const pinned = vi.hoisted(() => ({ current: undefined as boolean | undefined }));

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useMasterKeyPinned: () => pinned.current,
  useRotateMasterKeyMutation: () => rotate,
  useRestartServerMutation: () => vi.fn(),
  useSchedulerMonthsMutation: () => vi.fn(),
}));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    Object.assign((key: string) => `${namespace}.${key}`, {
      rich: (key: string) => `${namespace}.${key}`,
    }),
}));

const { default: SystemCard } = await import("@/features/admin/components/system/system-card");

const ROTATE = "settings.admin.system.masterKey.button";

beforeEach(() => {
  rotate.mockReset().mockResolvedValue(true);
  pinned.current = false;
  setConfigs({});
});

describe("SystemCard's master key rotation", () => {
  it("rotates only once the confirmation, which says every session ends, is confirmed", async () => {
    render(<SystemCard />);
    fireEvent.click(screen.getByRole("button", { name: ROTATE }));

    const dialog = await screen.findByRole("dialog");

    expect(rotate).not.toHaveBeenCalled();
    expect(within(dialog).getByText("settings.admin.rotateMasterKey.sessions")).toBeVisible();
    expect(within(dialog).getByText("settings.admin.rotateMasterKey.shareLinks")).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "settings.admin.rotateMasterKey.confirmButton" })
    );

    expect(rotate).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the confirmation open when the server did not take the rotation", async () => {
    rotate.mockResolvedValue(false);
    render(<SystemCard />);
    fireEvent.click(screen.getByRole("button", { name: ROTATE }));
    fireEvent.click(
      await screen.findByRole("button", { name: "settings.admin.rotateMasterKey.confirmButton" })
    );

    await waitFor(() => expect(rotate).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the MASTER_KEY instruction in env mode, in place of the button", () => {
    pinned.current = true;
    render(<SystemCard />);

    expect(screen.getByText("settings.admin.system.masterKey.pinned")).toBeVisible();
    expect(screen.queryByRole("button", { name: ROTATE })).toBeNull();
  });

  it("offers neither until the server says where the key comes from", () => {
    pinned.current = undefined;
    render(<SystemCard />);

    expect(screen.queryByText("settings.admin.system.masterKey.pinned")).toBeNull();
    expect(screen.queryByRole("button", { name: ROTATE })).toBeNull();
  });
});
