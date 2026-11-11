/**
 * An archive import runs on while the reader is elsewhere: the shell applies its completion and
 * says so once, on any page; the user settings page, which draws the bar, follows its progress.
 */
import { deliver } from "@/__tests__/helpers/trpc-fake";
import { ShellSubscriptions } from "@/app/(app)/shell-subscriptions";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { useArchiveImport, useArchiveImportProgress } from "@norish/shared-react/recipes";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const COMPLETED = { imported: 5, notes: [], errors: [] };

function ProgressBar() {
  useArchiveImportProgress();

  return null;
}

function renderWith(page: boolean) {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  useArchiveImport.getState().started(5);
  useArchiveImport.getState().progressed({ current: 2, total: 5, imported: 2, errors: [] });
  render(
    <>
      <ShellSubscriptions />
      {page ? <ProgressBar /> : null}
    </>,
    { wrapper: createTestWrapper(queryClient, platform) }
  );

  return {
    state: () => useArchiveImport.getState(),
    toasts: () => vi.mocked(platform.toast.show).mock.calls.map(([toast]) => toast),
  };
}

describe("an archive import's events", () => {
  it("are applied by the shell on any page, with one toast for the completion", () => {
    const { state, toasts } = renderWith(false);

    act(() => deliver("archive.onArchiveCompleted", COMPLETED));

    expect(state()).toMatchObject({ isImporting: false, imported: 5, current: 5 });
    expect(toasts()).toEqual([
      {
        severity: "success",
        title: "navbar.archiveImporter.toasts.completeTitle",
        description: "navbar.archiveImporter.toasts.completeDescription",
      },
    ]);
  });

  it("move the settings page's bar, which leaves the completion to the shell", () => {
    const { state, toasts } = renderWith(true);

    act(() =>
      deliver("archive.onArchiveProgress", { current: 3, total: 5, imported: 3, errors: [] })
    );
    expect(state()).toMatchObject({ isImporting: true, current: 3 });

    act(() => deliver("archive.onArchiveCompleted", COMPLETED));

    expect(state()).toMatchObject({ isImporting: false, imported: 5 });
    expect(toasts()).toHaveLength(1);
  });
});
