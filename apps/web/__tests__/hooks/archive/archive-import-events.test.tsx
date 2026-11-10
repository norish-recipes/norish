/**
 * An archive import runs on while the reader is elsewhere: the shell applies its completion and
 * says so once, on any page; the user settings page, which draws the bar, follows its progress.
 */
import { deliver } from "@/__tests__/helpers/trpc-fake";
import { ShellSubscriptions } from "@/app/(app)/shell-subscriptions";
import { useArchiveImportProgress } from "@/hooks/archive";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ARCHIVE_IMPORT_KEY } from "@norish/shared-react/hooks";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("@heroui/react", () => ({ toast }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const IMPORTING = { current: 2, total: 5, imported: 2, notes: [], isImporting: true, errors: [] };
const COMPLETED = { imported: 5, notes: [], errors: [] };

function ProgressBar() {
  useArchiveImportProgress();

  return null;
}

function renderWith(page: boolean) {
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(ARCHIVE_IMPORT_KEY, IMPORTING);
  render(
    <>
      <ShellSubscriptions />
      {page ? <ProgressBar /> : null}
    </>,
    { wrapper: createTestWrapper(queryClient) }
  );

  return () => queryClient.getQueryData<typeof IMPORTING>(ARCHIVE_IMPORT_KEY);
}

describe("an archive import's events", () => {
  it("are applied by the shell on any page, with one toast for the completion", () => {
    toast.mockClear();
    const state = renderWith(false);

    act(() => deliver("archive.onArchiveCompleted", COMPLETED));

    expect(state()).toMatchObject({ isImporting: false, imported: 5, current: 5 });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("move the settings page's bar, which leaves the completion to the shell", () => {
    toast.mockClear();
    const state = renderWith(true);

    act(() =>
      deliver("archive.onArchiveProgress", { current: 3, total: 5, imported: 3, errors: [] })
    );
    expect(state()).toMatchObject({ isImporting: true, current: 3 });

    act(() => deliver("archive.onArchiveCompleted", COMPLETED));

    expect(state()).toMatchObject({ isImporting: false, imported: 5 });
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
