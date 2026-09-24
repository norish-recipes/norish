/**
 * Render a hook under a QueryClient, the way the hook tests here do it:
 * `createRoot` and `act`, no extra library.
 */

import type { QueryClient } from "@tanstack/react-query";
import React, { act } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

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
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );
  });

  return {
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}
