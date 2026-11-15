import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import { useRecipeMutationErrorToast } from "..";

function render() {
  const adapter = fakePlatformAdapter();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlatformProvider adapter={adapter}>{children}</PlatformProvider>
  );
  const { result } = renderHook(() => useRecipeMutationErrorToast(), { wrapper });

  return { show: adapter.toast.show, onError: result.current };
}

describe("useRecipeMutationErrorToast", () => {
  it("says the change is saved offline when it was queued, not that it failed", () => {
    const { show, onError } = render();

    // No HTTP status: the backend-unreachable shape the Outbox link captures.
    onError(new TRPCClientError("Failed to fetch"), "create");

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith({
      severity: "warning",
      title: "common.queuedOffline.title",
      description: "common.queuedOffline.description",
    });
  });

  it("shows a generic failure, not the backend's message, for a rejected write", () => {
    const { show, onError } = render();

    onError(new Error("Very long backend stack trace"), "create");

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith({
      severity: "default",
      title: "common.errors.operationFailed",
      description: "common.errors.technicalDetails",
    });
  });
});
