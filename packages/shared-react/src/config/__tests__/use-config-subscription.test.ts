/** A list change, the household's or the instance's, rereads every read showing entry names or counts. */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "../../platform/testing";
import { keyOf, resetTRPCFake } from "../../trpc/testing";
import { useConfigSubscription } from "../use-config-subscription";

const handlers = vi.hoisted(() => new Map<string, () => void>());

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());
vi.mock("../../realtime", () => ({
  useKeepsCurrent: () => undefined,
  useRealtimeSubscription: (
    procedure: { subscriptionOptions: () => { path: string } },
    options: { onEvent: () => void }
  ) => {
    handlers.set(procedure.subscriptionOptions().path, options.onEvent);
  },
}));

afterEach(() => {
  handlers.clear();
  resetTRPCFake();
});

const SHOWING_NAMES = [
  keyOf("config.tags"),
  keyOf("lists.list", { kind: "tag" }),
  // The count a delete's confirmation shows.
  keyOf("lists.usage", { kind: "cuisine", id: "e1" }),
  keyOf("recipes.get", { id: "r1" }),
  keyOf("recipes.list", {}),
  keyOf("library.discover"),
  keyOf("library.suggest", { text: "so" }),
  keyOf("library.list", {}),
  keyOf("cookbooks.recipes", { id: "c1" }),
];

describe("useConfigSubscription", () => {
  it.each(["lists.onChanged", "config.onChanged"])(
    "rereads every read showing entry names or counts on %s",
    (path) => {
      const queryClient = createTestQueryClient();

      for (const queryKey of SHOWING_NAMES) queryClient.setQueryData(queryKey, {});
      renderHook(() => useConfigSubscription(), {
        wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
      });
      handlers.get(path)?.();

      expect(
        SHOWING_NAMES.filter((queryKey) => !queryClient.getQueryState(queryKey)?.isInvalidated)
      ).toEqual([]);
    }
  );
});
