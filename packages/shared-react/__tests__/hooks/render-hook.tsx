/**
 * Render a hook under a QueryClient and a fake platform, the way the hook tests here do it:
 * `createRoot` and `act`, no extra library.
 */

import type { QueryClient } from "@tanstack/react-query";
import React, { act } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";

export function renderHookWithClient(queryClient: QueryClient, useHook: () => void) {
  const container = document.createElement("div");

  document.body.appendChild(container);

  const root = createRoot(container);

  function Probe() {
    useHook();

    return null;
  }

  act(() => {
    root.render(
      <PlatformProvider adapter={fakePlatformAdapter()}>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </PlatformProvider>
    );
  });

  return {
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}
